const test = require('node:test');
const assert = require('node:assert');
const { getBracketSize, generateSeedOrder } = require('./bracket');

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