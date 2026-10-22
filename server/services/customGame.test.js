const test = require('node:test');
const assert = require('node:assert');
const { validateCustomGame } = require('./customGame');

const game = (overrides = {}) => ({ name: 'Pickleball', scoringFormat: 'single_score', ...overrides });

test('a simple custom game is accepted, with sets to win defaulting to 1', () => {
    assert.deepStrictEqual(validateCustomGame(game(), undefined), {
        gameType: { name: 'Pickleball', scoringFormat: 'single_score', config: null },
        scoringConfig: { setsToWin: 1 },
    });
});

test('names are trimmed and inner whitespace collapsed', () => {
    const r = validateCustomGame(game({ name: '  Office   Pong  ' }), {});
    assert.strictEqual(r.gameType.name, 'Office Pong');
});

test('names of exactly 40 characters are accepted, 41 are not', () => {
    assert.ok(!validateCustomGame(game({ name: 'a'.repeat(40) }), {}).error);
    assert.ok(validateCustomGame(game({ name: 'a'.repeat(41) }), {}).error);
});

test('blank, whitespace-only, and non-string names are rejected', () => {
    for (const name of ['', '   ', undefined, null, 42, {}]) {
        assert.ok(validateCustomGame(game({ name }), {}).error, String(name));
    }
});

test('missing or non-object custom game details are rejected', () => {
    for (const value of [undefined, null, 'x', 5, []]) {
        assert.ok(validateCustomGame(value, {}).error, String(value));
    }
});

test('an unknown or missing scoring format is rejected', () => {
    assert.ok(validateCustomGame(game({ scoringFormat: 'best_of_sets' }), {}).error);
    assert.ok(validateCustomGame(game({ scoringFormat: undefined }), {}).error);
    });

test('sets to win must be a whole number from 1 to 9', () => {
    for (const bad of [0, -1, 10, 1.5, '2', null]) {
        assert.ok(validateCustomGame(game(), { setsToWin: bad }).error, String(bad));
    }
    assert.strictEqual(validateCustomGame(game(), { setsToWin: 9 }).scoringConfig.setsToWin, 9);
    assert.strictEqual(validateCustomGame(game(), { setsToWin: 1 }).scoringConfig.setsToWin, 1);
});

test('target and win-by are dropped for formats that do not use them', () => {
    for (const scoringFormat of ['single_score', 'binary_result']) {
        const r = validateCustomGame(game({ scoringFormat }), { setsToWin: 2, target: 21, winBy: 2 });
        assert.deepStrictEqual(r.scoringConfig, { setsToWin: 2 });
        assert.strictEqual(r.gameType.config, null);
    }
});

test('target_score builds both the tournament config and the game defaults', () => {
    const r = validateCustomGame(game({ scoringFormat: 'target_score' }), { setsToWin: 2, target: 11, winBy: 2 });
    assert.deepStrictEqual(r, {
        gameType: {
            name: 'Pickleball',
            scoringFormat: 'target_score',
            config: { defaultTarget: 11, defaultWinBy: 2 },
        },
        scoringConfig: { setsToWin: 2, target: 11, winBy: 2 },
    });
});

test('target_score requires a whole-number target from 1 to 999', () => {
    const t = (target) =>
        validateCustomGame(game({ scoringFormat: 'target_score' }), { target, winBy: 1 });
    for (const bad of [undefined, 0, -3, 1000, 11.5, '11', null]) {
        assert.ok(t(bad).error, String(bad));
    }
    assert.ok(!t(1).error);
    assert.ok(!t(999).error);
});

test('target_score requires win-by from 1 up to the target', () => {
    const w = (winBy) =>
        validateCustomGame(game({ scoringFormat: 'target_score' }), { target: 11, winBy });
    for (const bad of [undefined, 0, -1, 12, 2.5, '2', null]) {
        assert.ok(w(bad).error, String(bad));
    }
    assert.ok(!w(1).error);
    assert.ok(!w(11).error);
});

test('a missing config object falls back to defaults, or fails for target_score', () => {
    assert.strictEqual(validateCustomGame(game(), null).scoringConfig.setsToWin, 1);
    assert.ok(validateCustomGame(game({ scoringFormat: 'target_score' }), null).error);
});