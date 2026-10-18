const test = require('node:test');
const assert = require('node:assert');
const { buildRoundRobin, computeStandings } = require('./roundRobin');

const players = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

test('buildRoundRobin rejects fewer than 2 participants', () => {
    assert.throws(() => buildRoundRobin(['P1']));
    assert.throws(() => buildRoundRobin([]));
});

test('every pair plays exactly once', () => {
    for (let n = 2; n <= 9; n++) {
        const matches = buildRoundRobin(players(n));
        assert.strictEqual(matches.length, (n * (n - 1)) / 2);
        const pairs = new Set(matches.map((m) => [m.participant1, m.participant2].sort().join('|')));
        assert.strictEqual(pairs.size, matches.length);
    }
});

test('nobody plays twice in a round, and round sizes are right', () => {
    for (let n = 2; n <= 9; n++) {
        const matches = buildRoundRobin(players(n));
        const totalRounds = n % 2 === 0 ? n - 1 : n;
        assert.strictEqual(Math.max(...matches.map((m) => m.roundNumber)), totalRounds);
        for (let r = 1; r <= totalRounds; r++) {
            const round = matches.filter((m) => m.roundNumber === r);
            const seen = round.flatMap((m) => [m.participant1, m.participant2]);
            assert.strictEqual(new Set(seen).size, seen.length);
            assert.strictEqual(round.length, Math.floor(n / 2));
        }
    }
});

test('odd counts: each participant sits out exactly one round', () => {
    for (const n of [3, 5, 7, 9]) {
        const matches = buildRoundRobin(players(n));
        for (const p of players(n)) {
            const roundsPlayed = new Set(matches.filter((m) => m.participant1 === p || m.participant2 === p).map((m) => m.roundNumber));
            assert.strictEqual(roundsPlayed.size, n - 1);
        }
    }
});

test('matches are numbered from 1 in each round and start pending', () => {
    const matches = buildRoundRobin(players(6));
    for (let r = 1; r <= 5; r++) {
        const nums = matches.filter((m) => m.roundNumber === r).map((m) => m.matchNumber).sort((a, b) => a - b);
        assert.deepStrictEqual(nums, [1, 2, 3]);
    }
    assert.ok(matches.every((m) => m.status === 'pending' && !m.isBye && m.winner === null && m.next === null));
});

const part = (id, seedNumber, disqualified = false) => ({ id, seedNumber, disqualified });
const done = (p1, p2, winner, extra = {}) => ({
    participant1Id: p1,
    participant2Id: p2,
    winnerId: winner,
    status: 'completed',
    isBye: false,
    isForfeit: false,
    scoreData: null,
    ...extra,
});
const order = (table) => table.map((s) => s.participantId);

test('standings rank by wins', () => {
    const table = computeStandings(
        [part('A', 1), part('B', 2), part('C', 3)],
        [done('A', 'B', 'A'), done('A', 'C', 'A'), done('B', 'C', 'B')],
        'single_score'
    );
    assert.deepStrictEqual(order(table), ['A', 'B', 'C']);
    assert.deepStrictEqual(table.map((s) => s.rank), [1, 2, 3]);
    assert.strictEqual(table[0].wins, 2);
    assert.strictEqual(table[0].played, 2);
});

test('head-to-head breaks a two-way tie ahead of seed', () => {
    const table = computeStandings(
        [part('B', 1), part('A', 2), part('C', 3)],
        [done('A', 'B', 'A'), done('B', 'C', 'B')],
        'single_score'
    );
    assert.deepStrictEqual(order(table), ['A', 'B', 'C']);
});

test('set difference breaks a three-way tie', () => {
    const table = computeStandings(
        [part('A', 1), part('B', 2), part('C', 3)],
        [
            done('A', 'B', 'A', { scoreData: { sets: [{ result: 'p1_win' }, { result: 'p1_win' }] } }),
            done('B', 'C', 'B', { scoreData: { sets: [{ result: 'p1_win' }] } }),
            done('C', 'A', 'C', { scoreData: { sets: [{ result: 'p1_win' }] } }),
        ],
        'binary_result'
    );
    assert.deepStrictEqual(order(table), ['A', 'C', 'B']);
});

test('point difference breaks a tie when set difference is level', () => {
    const table = computeStandings(
        [part('A', 1), part('B', 2), part('C', 3)],
        [
            done('A', 'B', 'A', { scoreData: { sets: [{ p1: 10, p2: 5 }] } }),
            done('B', 'C', 'B', { scoreData: { sets: [{ p1: 7, p2: 6 }] } }),
            done('C', 'A', 'C', { scoreData: { sets: [{ p1: 9, p2: 8 }] } }),
        ],
        'single_score'
    );
    assert.deepStrictEqual(order(table), ['A', 'C', 'B']);
});

test('seed is the last resort', () => {
    const table = computeStandings([part('B', 2), part('A', 1)], [], 'single_score');
    assert.deepStrictEqual(order(table), ['A', 'B']);
});

test('disqualified participants are listed last even with more wins', () => {
    const table = computeStandings(
        [part('A', 1, true), part('B', 2), part('C', 3)],
        [done('A', 'B', 'A'), done('A', 'C', 'A'), done('B', 'C', 'B')],
        'single_score'
    );
    assert.deepStrictEqual(order(table), ['B', 'C', 'A']);
    assert.strictEqual(table[2].disqualified, true);
});

test('forfeits count as a win and a loss but add no sets or points', () => {
    const table = computeStandings(
        [part('A', 1), part('B', 2)],
        [done('A', 'B', 'B', { isForfeit: true, scoreData: { sets: [{ p1: 5, p2: 3 }] } })],
        'single_score'
    );
    const a = table.find((s) => s.participantId === 'A');
    const b = table.find((s) => s.participantId === 'B');
    assert.strictEqual(b.wins, 1);
    assert.strictEqual(a.losses, 1);
    assert.strictEqual(a.setsWon + b.setsWon + a.pointsFor + b.pointsFor, 0);
});

test('unfinished matches are ignored', () => {
    const table = computeStandings(
        [part('A', 1), part('B', 2)],
        [done('A', 'B', null, { status: 'in_progress' })],
        'single_score'
    );
    assert.ok(table.every((s) => s.played === 0));
});