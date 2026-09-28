const test = require('node:test');
const assert = require('node:assert');
const { getBracketSize, generateSeedOrder, buildBracket } = require('./bracket');

test('getBracketSize rounds up to the next power of 2', () => {
    assert.strictEqual(getBracketSize(2), 2);
    assert.strictEqual(getBracketSize(3), 4);
    assert.strictEqual(getBracketSize(4), 4);
    assert.strictEqual(getBracketSize(5), 8);
    assert.strictEqual(getBracketSize(6), 8);
    assert.strictEqual(getBracketSize(8), 8);
    assert.strictEqual(getBracketSize(11), 16);
    assert.strictEqual(getBracketSize(16), 16);
    assert.strictEqual(getBracketSize(17), 32);
});

test('getBracketSize rejects fewer than 2 participants', () => {
    assert.throws(() => getBracketSize(1));
    assert.throws(() => getBracketSize(0));
});

test('generateSeedOrder matches known brackets', () => {
    assert.deepStrictEqual(generateSeedOrder(2), [1, 2]);
    assert.deepStrictEqual(generateSeedOrder(4), [1, 4, 2, 3]);
    assert.deepStrictEqual(generateSeedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
    assert.deepStrictEqual(
        generateSeedOrder(16),
        [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
    );
});

test('generateSeedOrder rejects non-powers of 2', () => {
    assert.throws(() => generateSeedOrder(6));
    assert.throws(() => generateSeedOrder(0));
});

test('every seed appears exactly once', () => {
    for (const size of [2, 4, 8, 16, 32, 64]) {
        const order = generateSeedOrder(size);
        const sorted = [...order].sort((a, b) => a - b);
        assert.deepStrictEqual(sorted, Array.from({ length: size }, (_, i) => i + 1));
    }
});

test('every first-round pair sums to size + 1', () => {
    for (const size of [2, 4, 8, 16, 32, 64]) {
        const order = generateSeedOrder(size);
        for (let i = 0; i < size; i += 2) {
            assert.strictEqual(order[i] + order[i + 1], size + 1);
        }
    }
});

test('seeds 1 and 2 are in opposite halves of the bracket', () => {
    for (const size of [4, 8, 16, 32]) {
        const order = generateSeedOrder(size);
        const half = size / 2;
        const pos1 = order.indexOf(1);
        const pos2 = order.indexOf(2);
        assert.notStrictEqual(pos1 < half, pos2 < half);
    }
});

const players = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const find = (matches, round, num) => matches.find((m) => m.roundNumber === round && m.matchNumber === num);
const COUNTS = [2, 3, 4, 5, 6, 7, 8, 11, 16, 17];

test('buildBracket rejects fewer than 2 participants', () => {
    assert.throws(() => buildBracket(['P1']));
    assert.throws(() => buildBracket([]));
});

test('a bracket always has size - 1 matches, with the right count per round', () => {
    for (const n of COUNTS) {
        const size = getBracketSize(n);
        const matches = buildBracket(players(n));
        assert.strictEqual(matches.length, size - 1);
        for (let r = 1; r <= Math.log2(size); r++) {
            const inRound = matches.filter((m) => m.roundNumber === r).length;
            assert.strictEqual(inRound, size / 2 ** r);
        }
    }
});

test('bye count is size - participants, and byes only occur in round 1', () => {
    for (const n of COUNTS) {
        const size = getBracketSize(n);
        const byes = buildBracket(players(n)).filter((m) => m.isBye);
        assert.strictEqual(byes.length, size - n);
        assert.ok(byes.every((m) => m.roundNumber === 1));
    }
});

test('byes go to the top seeds', () => {
    for (const n of COUNTS) {
        const size = getBracketSize(n);
        const topSeeds = players(size - n);
        const byes = buildBracket(players(n)).filter((m) => m.isBye);
        for (const bye of byes) {
            assert.ok(topSeeds.includes(bye.winner));
        }
    }
});

test('every participant appears exactly once in round 1', () => {
    for (const n of COUNTS) {
        const round1 = buildBracket(players(n)).filter((m) => m.roundNumber === 1);
        const seen = round1.flatMap((m) => [m.participant1, m.participant2]).filter(Boolean);
        assert.strictEqual(seen.length, n);
        assert.strictEqual(new Set(seen).size, n);
    }
});

test('next links: final has none, every other match links to a real match, each slot is fed exactly once', () => {
    for (const n of COUNTS) {
        const size = getBracketSize(n);
        const matches = buildBracket(players(n));
        const final = find(matches, Math.log2(size), 1);
        assert.strictEqual(final.next, null);

        const feeds = new Map();
        for (const m of matches.filter((x) => x !== final)) {
            assert.ok(find(matches, m.next.roundNumber, m.next.matchNumber));
            const key = `${m.next.roundNumber}-${m.next.matchNumber}-${m.next.slot}`;
            feeds.set(key, (feeds.get(key) || 0) + 1);
        }
        assert.ok([...feeds.values()].every((v) => v === 1));
    }
});

test('2 players: a single match, no byes, no next match', () => {
    const matches = buildBracket(players(2));
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].participant1, 'P1');
    assert.strictEqual(matches[0].participant2, 'P2');
    assert.strictEqual(matches[0].isBye, false);
    assert.strictEqual(matches[0].next, null);
});

test('3 players: seed 1 gets the bye and starts in the final', () => {
    const matches = buildBracket(players(3));
    const bye = find(matches, 1, 1);
    assert.strictEqual(bye.isBye, true);
    assert.strictEqual(bye.winner, 'P1');
    assert.strictEqual(bye.status, 'completed');

    const semi = find(matches, 1, 2);
    assert.deepStrictEqual([semi.participant1, semi.participant2], ['P2', 'P3']);

    const final = find(matches, 2, 1);
    assert.strictEqual(final.participant1, 'P1');
    assert.strictEqual(final.participant2, null);
});

test('6 players: known layout with byes for seeds 1 and 2', () => {
    const matches = buildBracket(players(6));

    assert.deepStrictEqual(
        [1, 2, 3, 4].map((n) => {
            const m = find(matches, 1, n);
            return [m.participant1, m.participant2, m.isBye];
        }),
        [
            ['P1', null, true],
            ['P4', 'P5', false],
            ['P2', null, true],
            ['P3', 'P6', false],
        ]
    );

    const r2m1 = find(matches, 2, 1);
    const r2m2 = find(matches, 2, 2);
    assert.deepStrictEqual([r2m1.participant1, r2m1.participant2], ['P1', null]);
    assert.deepStrictEqual([r2m2.participant1, r2m2.participant2], ['P2', null]);
});