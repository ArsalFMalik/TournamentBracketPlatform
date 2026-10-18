const test = require('node:test');
const assert = require('node:assert');
const { computeRecord, deriveTournamentResult } = require('./stats');

const match = (overrides) => ({
    participant1Id: 'a',
    participant2Id: 'b',
    winnerId: 'a',
    status: 'completed',
    isBye: false,
    isForfeit: false,
    ...overrides,
});
const bracket = (overrides = []) => {
    const base = [
        { roundNumber: 1, participant1Id: 'a', participant2Id: 'b', winnerId: null, status: 'pending', isBye: false },
        { roundNumber: 1, participant1Id: 'c', participant2Id: 'd', winnerId: null, status: 'pending', isBye: false },
        { roundNumber: 2, participant1Id: null, participant2Id: null, winnerId: null, status: 'pending', isBye: false },
    ];
    return base.map((m, i) => ({ ...m, ...(overrides[i] || {}) }));
};
const player = (id, disqualified = false) => ({ id, disqualified });

test('counts wins and losses from completed matches', () => {
    const matches = [
        match({ winnerId: 'a' }),
        match({ participant1Id: 'c', participant2Id: 'a', winnerId: 'c' }),
        match({ participant1Id: 'a', participant2Id: 'd', winnerId: 'a' }),
    ];
    assert.deepStrictEqual(computeRecord(matches, ['a']), {
        wins: 2, losses: 1, played: 3, forfeitWins: 0, forfeitLosses: 0,
    });
});

test('byes are excluded from the record', () => {
    const matches = [match({ participant2Id: null, isBye: true, winnerId: 'a' })];
    assert.deepStrictEqual(computeRecord(matches, ['a']), {
        wins: 0, losses: 0, played: 0, forfeitWins: 0, forfeitLosses: 0,
    });
});

test('forfeits count as a loss for the disqualified player and a win for the opponent', () => {
    const matches = [match({ isForfeit: true, winnerId: 'b' })];
    assert.deepStrictEqual(computeRecord(matches, ['a']), {
        wins: 0, losses: 1, played: 1, forfeitWins: 0, forfeitLosses: 1,
    });
    assert.deepStrictEqual(computeRecord(matches, ['b']), {
        wins: 1, losses: 0, played: 1, forfeitWins: 1, forfeitLosses: 0,
    });
});

test('pending and in-progress matches are ignored', () => {
    const matches = [
        match({ status: 'pending', winnerId: null }),
        match({ status: 'in_progress', winnerId: null }),
    ];
    assert.strictEqual(computeRecord(matches, ['a']).played, 0);
});

test('matches that do not involve the user are ignored', () => {
    const matches = [match({ participant1Id: 'x', participant2Id: 'y', winnerId: 'x' })];
    assert.strictEqual(computeRecord(matches, ['a']).played, 0);
});

test('combines several participant ids (one per tournament)', () => {
    const matches = [
        match({ participant1Id: 'a1', participant2Id: 'b', winnerId: 'a1' }),
        match({ participant1Id: 'c', participant2Id: 'a2', winnerId: 'c' }),
    ];
    const record = computeRecord(matches, ['a1', 'a2']);
    assert.strictEqual(record.wins, 1);
    assert.strictEqual(record.losses, 1);
    assert.strictEqual(record.played, 2);
});

test('empty input gives a zero record', () => {
    assert.deepStrictEqual(computeRecord([], ['a']), {
        wins: 0, losses: 0, played: 0, forfeitWins: 0, forfeitLosses: 0,
    });
});

test('result: registration while no bracket exists', () => {
    assert.deepStrictEqual(deriveTournamentResult(player('a'), 'registration', []), {
        result: 'registration', totalRounds: 0,
    });
});

test('result: in progress while the player is still alive', () => {
    const matches = bracket([{ status: 'completed', winnerId: 'a' }]);
    assert.strictEqual(deriveTournamentResult(player('a'), 'in_progress', matches).result, 'in_progress');
});

test('result: eliminated reports the round of the loss', () => {
    const matches = bracket([{ status: 'completed', winnerId: 'a' }]);
    assert.deepStrictEqual(deriveTournamentResult(player('b'), 'in_progress', matches), {
        result: 'eliminated', eliminatedRound: 1, totalRounds: 2,
    });
});

test('result: champion only once the tournament is completed', () => {
    const matches = bracket([
        { status: 'completed', winnerId: 'a' },
        { status: 'completed', winnerId: 'c' },
        { participant1Id: 'a', participant2Id: 'c', status: 'completed', winnerId: 'a' },
    ]);
    assert.strictEqual(deriveTournamentResult(player('a'), 'completed', matches).result, 'champion');
    const runnerUp = deriveTournamentResult(player('c'), 'completed', matches);
    assert.strictEqual(runnerUp.result, 'eliminated');
    assert.strictEqual(runnerUp.eliminatedRound, 2);
});

test('result: disqualified takes precedence over elimination', () => {
    const matches = bracket([{ status: 'completed', winnerId: 'a', isForfeit: true }]);
    assert.strictEqual(deriveTournamentResult(player('b', true), 'in_progress', matches).result, 'disqualified');
});

test('result: a bye win is not treated as a loss', () => {
    const matches = bracket([
        { participant2Id: null, isBye: true, status: 'completed', winnerId: 'a' },
    ]);
    assert.strictEqual(deriveTournamentResult(player('a'), 'in_progress', matches).result, 'in_progress');
});

test('round robin result: in progress until the tournament completes', () => {
    const r = deriveTournamentResult(player('a'), 'in_progress', bracket(), { rank: 1, totalParticipants: 4 });
    assert.strictEqual(r.result, 'in_progress');
});

test('round robin result: rank 1 is champion once completed', () => {
    const r = deriveTournamentResult(player('a'), 'completed', bracket(), { rank: 1, totalParticipants: 4 });
    assert.strictEqual(r.result, 'champion');
});

test('round robin result: other ranks are reported as placed', () => {
    assert.deepStrictEqual(
        deriveTournamentResult(player('a'), 'completed', bracket(), { rank: 3, totalParticipants: 5 }),
        { result: 'placed', rank: 3, totalParticipants: 5, totalRounds: 2 }
    );
});

test('round robin result: disqualified is still disqualified', () => {
    const r = deriveTournamentResult(player('a', true), 'completed', bracket(), { rank: 5, totalParticipants: 5 });
    assert.strictEqual(r.result, 'disqualified');
});