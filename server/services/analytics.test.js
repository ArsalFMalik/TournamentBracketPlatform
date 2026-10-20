const test = require('node:test');
const assert = require('node:assert');
const {
    matchResultMetrics,
    closestMatches,
    mostDominantMatches,
    averageSetsPerMatch,
} = require('./analytics');

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not close to ${b}`);

const m = (overrides = {}) => ({
    id: 'm1',
    scoringFormat: 'single_score',
    status: 'completed',
    isBye: false,
    isForfeit: false,
    participant1Id: 'a',
    participant2Id: 'b',
    winnerId: 'a',
    scoreData: { sets: [{ p1: 10, p2: 5 }] },
    ...overrides,
});
const score = (id, p1, p2, extra = {}) => m({ id, scoreData: { sets: [{ p1, p2 }] }, winnerId: p1 > p2 ? 'a' : 'b', ...extra });
const ids = (list) => list.map((r) => r.id);

test('metrics: single numeric set', () => {
    const r = matchResultMetrics(score('x', 10, 5));
    assert.strictEqual(r.unit, 'points');
    assert.strictEqual(r.winnerUnits, 10);
    assert.strictEqual(r.loserUnits, 5);
    assert.strictEqual(r.margin, 5);
    near(r.ratio, 1 / 3);
    assert.strictEqual(r.setsPlayed, 1);
    assert.strictEqual(r.informative, true);
});

test('metrics: measured from the winner when the winner is player 2', () => {
    const r = matchResultMetrics(score('x', 5, 10));
    assert.strictEqual(r.winnerUnits, 10);
    assert.strictEqual(r.margin, 5);
});

test('metrics: points are summed across sets', () => {
    const sets = [{ p1: 21, p2: 15 }, { p1: 19, p2: 21 }, { p1: 21, p2: 18 }];
    const r = matchResultMetrics(m({ scoreData: { sets } }));
    assert.strictEqual(r.winnerUnits, 61);
    assert.strictEqual(r.loserUnits, 54);
    assert.strictEqual(r.margin, 7);
    assert.strictEqual(r.setsPlayed, 3);
});

test('metrics: a multi-set winner can have a negative margin', () => {
    const sets = [{ p1: 21, p2: 20 }, { p1: 21, p2: 20 }, { p1: 0, p2: 21 }];
    const r = matchResultMetrics(m({ scoreData: { sets } }));
    assert.strictEqual(r.margin, -19);
    assert.ok(r.ratio < 0);
});

test('metrics: binary_result counts decisive sets', () => {
    const sets = [{ result: 'p1_win' }, { result: 'p2_win' }, { result: 'p1_win' }];
    const r = matchResultMetrics(m({ scoringFormat: 'binary_result', scoreData: { sets } }));
    assert.strictEqual(r.unit, 'sets');
    assert.strictEqual(r.winnerUnits, 2);
    assert.strictEqual(r.loserUnits, 1);
    assert.strictEqual(r.margin, 1);
    near(r.ratio, 1 / 3);
    assert.strictEqual(r.informative, true);
});

test('metrics: draws are ignored in binary_result', () => {
    const sets = [{ result: 'draw' }, { result: 'p1_win' }, { result: 'p1_win' }];
    const r = matchResultMetrics(m({ scoringFormat: 'binary_result', scoreData: { sets } }));
    assert.strictEqual(r.winnerUnits, 2);
    assert.strictEqual(r.loserUnits, 0);
    near(r.ratio, 1);
    assert.strictEqual(r.informative, true);
});

test('metrics: a binary_result match decided by one game is not informative', () => {
    const r = matchResultMetrics(m({ scoringFormat: 'binary_result', scoreData: { sets: [{ result: 'p1_win' }] } }));
    assert.strictEqual(r.informative, false);
});

test('metrics: unscorable matches return null', () => {
    const bad = [
        { status: 'pending' },
        { status: 'in_progress' },
        { isBye: true },
        { isForfeit: true },
        { scoreData: null },
        { scoreData: { sets: [] } },
        { winnerId: null },
        { winnerId: 'someone-else' },
        { scoreData: { sets: [{ p1: 0, p2: 0 }] } },
    ];
    for (const overrides of bad) {
        assert.strictEqual(matchResultMetrics(m(overrides)), null, JSON.stringify(overrides));
    }
});

const sample = [
    score('A', 11, 10),
    score('B', 11, 3),
    score('C', 21, 20),
    score('D', 11, 0),
];

test('closestMatches orders by smallest normalized margin', () => {
    assert.deepStrictEqual(ids(closestMatches(sample)), ['C', 'A', 'B', 'D']);
});

test('mostDominantMatches orders by largest normalized margin', () => {
    assert.deepStrictEqual(ids(mostDominantMatches(sample)), ['D', 'B', 'A', 'C']);
});

test('limit caps the number of results', () => {
    assert.strictEqual(closestMatches(sample, 2).length, 2);
    assert.strictEqual(mostDominantMatches(sample, 1).length, 1);
});

test('dominant ties on ratio go to the larger raw margin', () => {
    assert.deepStrictEqual(ids(mostDominantMatches([score('E', 11, 0), score('F', 21, 0)])), ['F', 'E']);
});

test('closest ties on ratio go to the smaller raw margin', () => {
    assert.deepStrictEqual(ids(closestMatches([score('H', 22, 20), score('G', 11, 10)])), ['G', 'H']);
});

test('a negative-margin winner counts as close but never dominant', () => {
    const x = m({
        id: 'X',
        scoreData: { sets: [{ p1: 21, p2: 20 }, { p1: 21, p2: 20 }, { p1: 0, p2: 21 }] },
    });
    const y = score('Y', 11, 10);
    assert.deepStrictEqual(ids(closestMatches([x, y])), ['Y', 'X']);
    assert.deepStrictEqual(ids(mostDominantMatches([x, y])), ['Y', 'X']);
});

test('byes, forfeits, and unfinished matches are left out of both lists', () => {
    const list = [
        score('ok', 11, 5),
        score('bye', 11, 5, { isBye: true }),
        score('ff', 11, 5, { isForfeit: true }),
        score('pending', 11, 5, { status: 'pending' }),
    ];
    assert.deepStrictEqual(ids(closestMatches(list)), ['ok']);
    assert.deepStrictEqual(ids(mostDominantMatches(list)), ['ok']);
});

test('single-game Chess matches are excluded, longer ones are included', () => {
    const chess = (id, sets) => m({ id, scoringFormat: 'binary_result', scoreData: { sets } });
    const list = [
        chess('bo1', [{ result: 'p1_win' }]),
        chess('bo3', [{ result: 'p1_win' }, { result: 'p2_win' }, { result: 'p1_win' }]),
        chess('sweep', [{ result: 'p1_win' }, { result: 'p1_win' }]),
    ];
    assert.deepStrictEqual(ids(closestMatches(list)), ['bo3', 'sweep']);
    assert.deepStrictEqual(ids(mostDominantMatches(list)), ['sweep', 'bo3']);
});

test('average sets per match', () => {
    const list = [
        m({ scoreData: { sets: [{ p1: 1, p2: 0 }] } }),
        m({ scoreData: { sets: [{ p1: 1, p2: 0 }, { p1: 0, p2: 1 }, { p1: 1, p2: 0 }] } }),
        m({ scoreData: { sets: [{ p1: 1, p2: 0 }, { p1: 1, p2: 0 }] } }),
    ];
    assert.deepStrictEqual(averageSetsPerMatch(list), { count: 3, average: 2 });
});

test('average sets is rounded to two decimals', () => {
    const one = m({ scoreData: { sets: [{ p1: 1, p2: 0 }] } });
    const two = m({ scoreData: { sets: [{ p1: 1, p2: 0 }, { p1: 1, p2: 0 }] } });
    assert.strictEqual(averageSetsPerMatch([one, one, two]).average, 1.33);
});

test('average sets skips byes, forfeits, and unfinished matches', () => {
    const list = [
        m(),
        m({ isBye: true }),
        m({ isForfeit: true }),
        m({ status: 'in_progress' }),
        m({ scoreData: null }),
    ];
    assert.deepStrictEqual(averageSetsPerMatch(list), { count: 1, average: 1 });
});

test('average sets with no usable matches', () => {
    assert.deepStrictEqual(averageSetsPerMatch([]), { count: 0, average: null });
});