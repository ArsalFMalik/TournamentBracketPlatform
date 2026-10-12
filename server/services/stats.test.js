const test = require('node:test');
const assert = require('node:assert');
const { computeRecord } = require('./stats');

const match = (overrides) => ({
    participant1Id: 'a',
    participant2Id: 'b',
    winnerId: 'a',
    status: 'completed',
    isBye: false,
    isForfeit: false,
    ...overrides,
});

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