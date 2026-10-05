const test = require('node:test');
const assert = require('node:assert');
const { determineSetWinner, determineMatchWinner } = require('./scoring');

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