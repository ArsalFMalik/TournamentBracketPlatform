const test = require('node:test');
const assert = require('node:assert');
const { buildDoubleElimination } = require('./doubleElimination');

const players = (n) => Array.from({ length: n }, (_, i) => i + 1);
const SIZES = Array.from({ length: 14 }, (_, i) => i + 3);
const find = (matches, key) => matches.find((m) => m.key === key);
const real = (matches) => matches.filter((m) => !m.isBye);

function simulate(matches, pick) {
    const state = new Map(
        matches.map((m) => [
            m.key,
            { ...m, p1: m.participant1, p2: m.participant2, done: m.status === 'completed' },
        ])
    );
    const losses = new Map();
    const loseOne = (p) => losses.set(p, (losses.get(p) || 0) + 1);
    const place = (target, participant) => {
        const t = state.get(target.key);
        const field = target.slot === 1 ? 'p1' : 'p2';
        assert.strictEqual(t[field], null, `slot ${target.key}/${target.slot} was already filled`);
        t[field] = participant;
    };

    let champion = null;
    let runnerUp = null;
    let resetPlayed = false;
    let played = 0;

    for (;;) {
        const next = [...state.values()].find(
            (m) => !m.done && !m.isBye && m.key !== 'G-2-1' && m.p1 !== null && m.p2 !== null
        );
        if (!next) break;

        assert.notStrictEqual(next.p1, next.p2, `${next.key} pits a player against themselves`);
        for (const p of [next.p1, next.p2]) {
            assert.ok((losses.get(p) || 0) < 2, `${p} is playing ${next.key} after being eliminated`);
        }

        const winner = pick(next.p1, next.p2);
        const loser = winner === next.p1 ? next.p2 : next.p1;
        next.done = true;
        played++;
        loseOne(loser);

        if (next.bracket === 'grand_final') {
            if (winner === next.p1 || !state.has('G-2-1')) {
                champion = winner;
                runnerUp = loser;
            } else {
                const reset = state.get('G-2-1');
                reset.p1 = next.p1;
                reset.p2 = next.p2;
                const resetWinner = pick(reset.p1, reset.p2);
                const resetLoser = resetWinner === reset.p1 ? reset.p2 : reset.p1;
                reset.done = true;
                resetPlayed = true;
                played++;
                loseOne(resetLoser);
                champion = resetWinner;
                runnerUp = resetLoser;
            }
            continue;
        }

        assert.ok(next.winnerTo, `${next.key} has no winnerTo`);
        place(next.winnerTo, winner);
        if (next.bracket === 'winners') {
            assert.ok(next.loserTo, `${next.key} (winners) has no loserTo`);
            place(next.loserTo, loser);
        } else {
            assert.strictEqual(next.loserTo, null, `${next.key} (losers) should not have a loserTo`);
        }
    }

    const unfinished = [...state.values()].filter((m) => !m.done && !m.isBye && m.key !== 'G-2-1');
    assert.deepStrictEqual(unfinished.map((m) => m.key), [], 'some matches were never playable');
    return { champion, runnerUp, losses, played, resetPlayed };
}

test('rejects fewer than 3 or more than 16 participants', () => {
    assert.throws(() => buildDoubleElimination(players(2)));
    assert.throws(() => buildDoubleElimination([]));
    assert.throws(() => buildDoubleElimination(players(17)));
});

test('4 players: the exact structure', () => {
    const m = buildDoubleElimination(players(4));
    assert.deepStrictEqual(
        m.map((x) => x.key),
        ['W-1-1', 'W-1-2', 'W-2-1', 'L-1-1', 'L-2-1', 'G-1-1', 'G-2-1']
    );
    assert.deepStrictEqual([find(m, 'W-1-1').participant1, find(m, 'W-1-1').participant2], [1, 4]);
    assert.deepStrictEqual([find(m, 'W-1-2').participant1, find(m, 'W-1-2').participant2], [2, 3]);

    assert.deepStrictEqual(find(m, 'W-1-1').winnerTo, { key: 'W-2-1', slot: 1 });
    assert.deepStrictEqual(find(m, 'W-1-2').winnerTo, { key: 'W-2-1', slot: 2 });
    assert.deepStrictEqual(find(m, 'W-1-1').loserTo, { key: 'L-1-1', slot: 1 });
    assert.deepStrictEqual(find(m, 'W-1-2').loserTo, { key: 'L-1-1', slot: 2 });
    assert.deepStrictEqual(find(m, 'W-2-1').winnerTo, { key: 'G-1-1', slot: 1 });
    assert.deepStrictEqual(find(m, 'W-2-1').loserTo, { key: 'L-2-1', slot: 2 });
    assert.deepStrictEqual(find(m, 'L-1-1').winnerTo, { key: 'L-2-1', slot: 1 });
    assert.deepStrictEqual(find(m, 'L-2-1').winnerTo, { key: 'G-1-1', slot: 2 });
    assert.strictEqual(find(m, 'G-1-1').winnerTo, null);
});

test('8 players: winners-round-2 losers drop into the losers bracket in reverse order', () => {
    const m = buildDoubleElimination(players(8));
    assert.deepStrictEqual(find(m, 'W-2-1').loserTo, { key: 'L-2-2', slot: 2 });
    assert.deepStrictEqual(find(m, 'W-2-2').loserTo, { key: 'L-2-1', slot: 2 });
    assert.deepStrictEqual(find(m, 'W-3-1').loserTo, { key: 'L-4-1', slot: 2 });
    assert.strictEqual(real(m).length, 2 * 8 - 2 + 1);
});

test('3 players: seed 1 has a bye and the single losers match is round 1', () => {
    const m = buildDoubleElimination(players(3));
    assert.strictEqual(m.length, 6);

    const bye = find(m, 'W-1-1');
    assert.strictEqual(bye.isBye, true);
    assert.strictEqual(bye.winner, 1);
    assert.strictEqual(bye.status, 'completed');
    assert.strictEqual(bye.loserTo, null);
    assert.deepStrictEqual(bye.winnerTo, { key: 'W-2-1', slot: 1 });

    const finalW = find(m, 'W-2-1');
    assert.deepStrictEqual([finalW.participant1, finalW.participant2], [1, null]);

    const losers = find(m, 'L-2-1');
    assert.strictEqual(losers.roundNumber, 1);
    assert.deepStrictEqual(find(m, 'W-1-2').loserTo, { key: 'L-2-1', slot: 1 });
    assert.deepStrictEqual(finalW.loserTo, { key: 'L-2-1', slot: 2 });
});

test('5 players: losers rounds with nothing to play are skipped and the rest renumbered', () => {
    const m = buildDoubleElimination(players(5));
    assert.deepStrictEqual(m.filter((x) => x.bracket === 'winners' && x.roundNumber === 1 && !x.isBye).map((x) => x.key), ['W-1-2']);
    const losersRounds = new Set(m.filter((x) => x.bracket === 'losers').map((x) => x.roundNumber));
    assert.deepStrictEqual([...losersRounds].sort(), [1, 2, 3]);
    assert.deepStrictEqual(find(m, 'W-1-2').loserTo, { key: 'L-2-1', slot: 1 });
    assert.deepStrictEqual(find(m, 'W-2-2').loserTo, { key: 'L-2-1', slot: 2 });
    assert.deepStrictEqual(find(m, 'W-2-1').loserTo, { key: 'L-3-1', slot: 2 });
    assert.strictEqual(find(m, 'L-2-1').roundNumber, 1);
    assert.strictEqual(find(m, 'L-3-1').roundNumber, 2);
    assert.strictEqual(find(m, 'L-4-1').roundNumber, 3);
});

test('a match is only created for real contests: 2n - 2 non-bye matches, plus the reset', () => {
    for (const n of SIZES) {
        assert.strictEqual(real(buildDoubleElimination(players(n))).length, 2 * n - 1, `n=${n}`);
        assert.strictEqual(
            real(buildDoubleElimination(players(n), { grandFinalReset: false })).length,
            2 * n - 2,
            `n=${n} without reset`
        );
    }
});

test('the winners bracket always has size - 1 matches, and the right number of byes', () => {
    for (const n of SIZES) {
        const size = 2 ** Math.ceil(Math.log2(n));
        const winners = buildDoubleElimination(players(n)).filter((m) => m.bracket === 'winners');
        assert.strictEqual(winners.length, size - 1, `n=${n}`);
        assert.strictEqual(winners.filter((m) => m.isBye).length, size - n, `n=${n}`);
    }
});

test('byes go to the top seeds, are completed, and never send a loser anywhere', () => {
    for (const n of SIZES) {
        const size = 2 ** Math.ceil(Math.log2(n));
        const byes = buildDoubleElimination(players(n)).filter((m) => m.isBye);
        for (const bye of byes) {
            assert.ok(bye.winner <= size - n, `n=${n}: bye went to seed ${bye.winner}`);
            assert.strictEqual(bye.status, 'completed');
            assert.strictEqual(bye.loserTo, null);
            assert.ok(bye.winnerTo);
            assert.strictEqual(bye.roundNumber, 1);
        }
    }
});

test('every participant starts in exactly one winners round-1 slot', () => {
    for (const n of SIZES) {
        const m = buildDoubleElimination(players(n));
        const placed = m
            .filter((x) => x.bracket === 'winners' && x.roundNumber === 1)
            .flatMap((x) => [x.participant1, x.participant2])
            .filter((p) => p !== null);
        assert.deepStrictEqual([...placed].sort((a, b) => a - b), players(n), `n=${n}`);
    }
});

test('every slot of every playable match is filled exactly once, by a seed or by one link', () => {
    for (const n of SIZES) {
        for (const grandFinalReset of [true, false]) {
            const m = buildDoubleElimination(players(n), { grandFinalReset });
            const keys = new Set(m.map((x) => x.key));
            assert.strictEqual(keys.size, m.length, 'keys are unique');

            const incoming = new Map();
            const byIndex = new Map(m.map((x) => [x.key, x]));
            for (const x of m) {
                for (const link of [x.winnerTo, x.loserTo]) {
                    if (!link) continue;
                    assert.ok(keys.has(link.key), `${x.key} links to a missing match ${link.key}`);
                    assert.ok(link.slot === 1 || link.slot === 2);
                    if (x.isBye) {
                        assert.strictEqual(byIndex.get(link.key)[`participant${link.slot}`], x.winner);
                        continue;
                    }
                    const id = `${link.key}/${link.slot}`;
                    incoming.set(id, (incoming.get(id) || 0) + 1);
                }
            }

            for (const x of m) {
                if (x.isBye || x.key === 'G-2-1') continue;
                for (const slot of [1, 2]) {
                    const prefilled = x[`participant${slot}`] !== null ? 1 : 0;
                    const linked = incoming.get(`${x.key}/${slot}`) || 0;
                    assert.strictEqual(prefilled + linked, 1, `n=${n}: ${x.key} slot ${slot}`);
                }
            }
            if (grandFinalReset) {
                assert.strictEqual(incoming.get('G-2-1/1') || 0, 0);
                assert.strictEqual(incoming.get('G-2-1/2') || 0, 0);
            }
        }
    }
});

test('rounds and matches are numbered from 1 with no gaps in each bracket', () => {
    for (const n of SIZES) {
        const m = buildDoubleElimination(players(n));
        for (const bracket of ['winners', 'losers', 'grand_final']) {
            const inBracket = m.filter((x) => x.bracket === bracket);
            const rounds = [...new Set(inBracket.map((x) => x.roundNumber))].sort((a, b) => a - b);
            assert.deepStrictEqual(rounds, rounds.map((_, i) => i + 1), `n=${n} ${bracket} rounds`);
            for (const r of rounds) {
                const nums = inBracket.filter((x) => x.roundNumber === r).map((x) => x.matchNumber).sort((a, b) => a - b);
                assert.deepStrictEqual(nums, nums.map((_, i) => i + 1), `n=${n} ${bracket} round ${r}`);
            }
        }
    }
});

test('the grand final is a real match fed by both bracket finals', () => {
    for (const n of SIZES) {
        const m = buildDoubleElimination(players(n));
        const gf = find(m, 'G-1-1');
        assert.strictEqual(gf.isBye, false);
        const feeders = m.filter((x) => x.winnerTo?.key === 'G-1-1');
        assert.deepStrictEqual(feeders.map((x) => x.winnerTo.slot).sort(), [1, 2], `n=${n}`);
        assert.deepStrictEqual(feeders.map((x) => x.bracket).sort(), ['losers', 'winners']);
        assert.strictEqual(m.filter((x) => x.bracket === 'winners' && x.loserTo?.key).length > 0, true);
    }
});

test('the reset match only exists when asked for, and starts empty', () => {
    const withReset = buildDoubleElimination(players(8));
    const reset = find(withReset, 'G-2-1');
    assert.strictEqual(reset.bracket, 'grand_final');
    assert.strictEqual(reset.roundNumber, 2);
    assert.strictEqual(reset.status, 'pending');
    assert.deepStrictEqual([reset.participant1, reset.participant2], [null, null]);

    const without = buildDoubleElimination(players(8), { grandFinalReset: false });
    assert.strictEqual(find(without, 'G-2-1'), undefined);
    assert.strictEqual(without.filter((x) => x.bracket === 'grand_final').length, 1);
});

test('simulation: when the top seed always wins, they are champion with no losses and no reset', () => {
    for (const n of SIZES) {
        const m = buildDoubleElimination(players(n));
        const r = simulate(m, (a, b) => Math.min(a, b));
        assert.strictEqual(r.champion, 1, `n=${n}`);
        assert.strictEqual(r.losses.get(1) || 0, 0);
        assert.strictEqual(r.resetPlayed, false);
        assert.strictEqual(r.played, 2 * n - 2, `n=${n}`);
        for (const p of players(n).slice(1)) assert.strictEqual(r.losses.get(p), 2, `n=${n} p=${p}`);
    }
});

test('simulation: the lowest seed always winning forces a reset when it is enabled', () => {
    for (const n of SIZES) {
        const m = buildDoubleElimination(players(n));
        const r = simulate(m, (a, b) => Math.max(a, b));
        assert.ok(r.champion !== null, `n=${n}`);
        assert.strictEqual(r.played >= 2 * n - 2, true);
        for (const p of players(n)) {
            if (p !== r.champion) assert.strictEqual(r.losses.get(p), 2, `n=${n} p=${p}`);
            else assert.ok((r.losses.get(p) || 0) <= 1);
        }
    }
});

test('simulation: random results always finish, with everyone but the champion out after two losses', () => {
    let seedState = 12345;
    const rand = () => {
        seedState = (seedState * 1664525 + 1013904223) % 4294967296;
        return seedState / 4294967296;
    };
    for (const n of SIZES) {
        for (const grandFinalReset of [true, false]) {
            for (let trial = 0; trial < 40; trial++) {
                const m = buildDoubleElimination(players(n), { grandFinalReset });
                const r = simulate(m, (a, b) => (rand() < 0.5 ? a : b));
                assert.ok(r.champion !== null);
                assert.ok((r.losses.get(r.champion) || 0) <= 1);
                for (const p of players(n)) {
                    if (p === r.champion) continue;
                    const l = r.losses.get(p);
                    if (!grandFinalReset && p === r.runnerUp) assert.ok(l === 1 || l === 2);
                    else assert.strictEqual(l, 2, `n=${n} reset=${grandFinalReset} p=${p}`);
                }
                const expected = 2 * n - 2 + (r.resetPlayed ? 1 : 0);
                assert.strictEqual(r.played, expected, `n=${n} reset=${grandFinalReset}`);
            }
        }
    }
});