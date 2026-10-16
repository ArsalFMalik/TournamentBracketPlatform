const test = require('node:test');
const assert = require('node:assert');
const { determineSetWinner, determineMatchWinner, validateSubmission } = require('./scoring');

test('single_score: higher score wins, equal is a draw', () => {
    assert.strictEqual(determineSetWinner('single_score', null, { p1: 87, p2: 72 }), 'p1');
    assert.strictEqual(determineSetWinner('single_score', null, { p1: 60, p2: 75 }), 'p2');
    assert.strictEqual(determineSetWinner('single_score', null, { p1: 50, p2: 50 }), 'draw');
});

test('binary_result: reads result directly', () => {
    assert.strictEqual(determineSetWinner('binary_result', null, { result: 'p1_win' }), 'p1');
    assert.strictEqual(determineSetWinner('binary_result', null, { result: 'p2_win' }), 'p2');
    assert.strictEqual(determineSetWinner('binary_result', null, { result: 'draw' }), 'draw');
    assert.strictEqual(determineSetWinner('binary_result', null, {}), null);
});

test('target_score: incomplete until target and win-by margin are met', () => {
    const config = { target: 21, winBy: 2 };
    assert.strictEqual(determineSetWinner('target_score', config, { p1: 15, p2: 10 }), null);
    assert.strictEqual(determineSetWinner('target_score', config, { p1: 21, p2: 20 }), null);
    assert.strictEqual(determineSetWinner('target_score', config, { p1: 22, p2: 20 }), 'p1');
    assert.strictEqual(determineSetWinner('target_score', config, { p1: 19, p2: 21 }), 'p2');
});

test('target_score: uses config defaults if target/winBy missing', () => {
    assert.strictEqual(determineSetWinner('target_score', null, { p1: 11, p2: 9 }), 'p1');
    assert.strictEqual(determineSetWinner('target_score', null, { p1: 11, p2: 10 }), null);
});

test('determineMatchWinner: single_score Bo1 decides immediately', () => {
    const winner = determineMatchWinner('single_score', null, [{ p1: 10, p2: 5 }], 1);
    assert.strictEqual(winner, 'p1');
});

test('determineMatchWinner: binary_result Bo3 (Tekken-style)', () => {
    const sets = [{ result: 'p1_win' }, { result: 'p2_win' }, { result: 'p1_win' }];
    assert.strictEqual(determineMatchWinner('binary_result', null, sets, 2), 'p1');
});

test('determineMatchWinner: not decided until setsToWin is reached', () => {
    const sets = [{ result: 'p1_win' }];
    assert.strictEqual(determineMatchWinner('binary_result', null, sets, 2), null);
});

test('determineMatchWinner: a draw does not count toward either side (Option B)', () => {
    const sets = [{ result: 'draw' }, { result: 'p1_win' }];
    assert.strictEqual(determineMatchWinner('binary_result', null, sets, 2), null);

    const setsWithDecider = [...sets, { result: 'p1_win' }];
    assert.strictEqual(determineMatchWinner('binary_result', null, setsWithDecider, 2), 'p1');
});

test('determineMatchWinner: all draws never decides the match', () => {
    const sets = [{ result: 'draw' }, { result: 'draw' }, { result: 'draw' }];
    assert.strictEqual(determineMatchWinner('binary_result', null, sets, 2), null);
});

test('determineMatchWinner: throws if a set is incomplete', () => {
    const sets = [{ p1: 15, p2: 10 }];
    assert.throws(() => determineMatchWinner('target_score', { target: 21, winBy: 2 }, sets, 1));
});

test('validateSubmission: accepts a decisive match', () => {
    assert.deepStrictEqual(
        validateSubmission('single_score', null, 1, [{ p1: 10, p2: 5 }]),
        { matchWinner: 'p1' }
    );
});

test('validateSubmission: an undecided match is valid with no winner yet', () => {
    assert.deepStrictEqual(
        validateSubmission('binary_result', null, 2, [{ result: 'p1_win' }]),
        { matchWinner: null }
    );
});

test('validateSubmission: rejects empty, non-array, and non-object sets', () => {
    assert.ok(validateSubmission('single_score', null, 1, []).error);
    assert.ok(validateSubmission('single_score', null, 1, 'nope').error);
    assert.ok(validateSubmission('single_score', null, 1, [null]).error);
});

test('validateSubmission: rejects negative or fractional scores', () => {
    assert.ok(validateSubmission('single_score', null, 1, [{ p1: -3, p2: 5 }]).error);
    assert.ok(validateSubmission('single_score', null, 1, [{ p1: 2.5, p2: 1 }]).error);
});

test('validateSubmission: rejects an incomplete target_score set', () => {
    const config = { target: 21, winBy: 2 };
    assert.ok(validateSubmission('target_score', config, 1, [{ p1: 21, p2: 20 }]).error);
});

test('validateSubmission: rejects sets entered after the deciding set', () => {
    const sets = [{ result: 'p1_win' }, { result: 'p1_win' }, { result: 'p2_win' }];
    assert.ok(validateSubmission('binary_result', null, 2, sets).error);
});