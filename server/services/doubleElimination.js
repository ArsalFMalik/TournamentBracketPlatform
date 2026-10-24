const { getBracketSize, generateSeedOrder } = require('./bracket');

const MIN_PARTICIPANTS = 3;
const MAX_PARTICIPANTS = 16;

function buildDoubleElimination(seededParticipants, { grandFinalReset = true } = {}) {
    const count = seededParticipants.length;
    if (count < MIN_PARTICIPANTS || count > MAX_PARTICIPANTS) {
        throw new Error(`Double elimination supports ${MIN_PARTICIPANTS} to ${MAX_PARTICIPANTS} participants.`);
    }

    const size = getBracketSize(count);
    const rounds = Math.log2(size);
    const order = generateSeedOrder(size);

    const winnerOf = (key) => ({ type: 'winner', key });
    const loserOf = (key) => ({ type: 'loser', key });
    const seed = (participant) => ({ type: 'seed', participant: participant ?? null });

    const nodes = new Map();
    const add = (prefix, bracket, round, num, slots) => {
        const node = { key: `${prefix}-${round}-${num}`, bracket, round, num, slots };
        nodes.set(node.key, node);
    };

    for (let r = 1; r <= rounds; r++) {
        for (let m = 1; m <= size / 2 ** r; m++) {
        if (r === 1) {
            const i = (m - 1) * 2;
            add('W', 'winners', 1, m, [
                seed(seededParticipants[order[i] - 1]),
                seed(seededParticipants[order[i + 1] - 1]),
            ]);
        } else {
            add('W', 'winners', r, m, [winnerOf(`W-${r - 1}-${2 * m - 1}`), winnerOf(`W-${r - 1}-${2 * m}`)]);
        }
        }
    }

    for (let j = 1; j <= rounds - 1; j++) {
        const c = size / 2 ** (j + 1);
        for (let m = 1; m <= c; m++) {
            add(
                'L', 'losers', 2 * j - 1, m,
                j === 1
                    ? [loserOf(`W-1-${2 * m - 1}`), loserOf(`W-1-${2 * m}`)]
                    : [winnerOf(`L-${2 * j - 2}-${2 * m - 1}`), winnerOf(`L-${2 * j - 2}-${2 * m}`)]
            );
        }
        for (let m = 1; m <= c; m++) {
            add('L', 'losers', 2 * j, m, [winnerOf(`L-${2 * j - 1}-${m}`), loserOf(`W-${j + 1}-${c + 1 - m}`)]);
        }
    }

    add('G', 'grand_final', 1, 1, [winnerOf(`W-${rounds}-1`), winnerOf(`L-${2 * (rounds - 1)}-1`)]);

    const EMPTY = { kind: 'empty' };
    const infoCache = new Map();

    function resolve(src) {
        if (src.type === 'seed') {
            return src.participant === null ? EMPTY : { kind: 'seed', participant: src.participant };
        }
        return info(src.key).out[src.type];
    }

    function info(key) {
        if (infoCache.has(key)) return infoCache.get(key);
        const filled = nodes.get(key).slots.map(resolve).filter((x) => x.kind !== 'empty');

        let result;
        if (filled.length === 0) {
            result = { kind: 'void', created: false, out: { winner: EMPTY, loser: EMPTY } };
        } else if (filled.length === 1) {
            const occupant = filled[0];
            result = {
                kind: 'pass',
                created: occupant.kind === 'seed',
                occupant,
                out: { winner: occupant, loser: EMPTY },
            };
        } else {
            result = {
                kind: 'real',
                created: true,
                out: {
                    winner: { kind: 'match', key, output: 'winner' },
                    loser: { kind: 'match', key, output: 'loser' },
                },
            };
        }
        infoCache.set(key, result);
        return result;
    }

    const matches = new Map();
    for (const node of nodes.values()) {
        const inf = info(node.key);
        if (!inf.created) continue;
        matches.set(node.key, {
            key: node.key,
            bracket: node.bracket,
            structuralRound: node.round,
            structuralNum: node.num,
            participant1: null,
            participant2: null,
            winner: inf.kind === 'pass' ? inf.occupant.participant : null,
            isBye: inf.kind === 'pass',
            status: inf.kind === 'pass' ? 'completed' : 'pending',
            winnerTo: null,
            loserTo: null,
        });
    }

    for (const node of nodes.values()) {
        const inf = info(node.key);
        if (!inf.created) continue;
        const match = matches.get(node.key);

        node.slots.forEach((src, i) => {
            const slot = i + 1;
            const resolved = resolve(src);

            if (resolved.kind === 'seed') match[`participant${slot}`] = resolved.participant;
            if (inf.kind === 'pass' || src.type === 'seed') return;

            const feeder = info(src.key);
            if (feeder.created) {
                if (src.type === 'winner') matches.get(src.key).winnerTo = { key: node.key, slot };
                else if (feeder.kind === 'real') matches.get(src.key).loserTo = { key: node.key, slot };
            } else if (resolved.kind === 'match') {
                const target = matches.get(resolved.key);
                if (resolved.output === 'winner') target.winnerTo = { key: node.key, slot };
                else target.loserTo = { key: node.key, slot };
            }
        });
    }

    if (grandFinalReset) {
        matches.set('G-2-1', {
            key: 'G-2-1',
            bracket: 'grand_final',
            structuralRound: 2,
            structuralNum: 1,
            participant1: null,
            participant2: null,
            winner: null,
            isBye: false,
            status: 'pending',
            winnerTo: null,
            loserTo: null,
        });
    }

    const list = [...matches.values()];
    const losersRounds = [...new Set(list.filter((m) => m.bracket === 'losers').map((m) => m.structuralRound)),].sort((a, b) => a - b);
    for (const m of list) {
        m.roundNumber = m.bracket === 'losers' ? losersRounds.indexOf(m.structuralRound) + 1 : m.structuralRound;
    }

    const groups = new Map();
    for (const m of list) {
        const g = `${m.bracket}:${m.roundNumber}`;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(m);
    }
    for (const group of groups.values()) {
        group.sort((a, b) => a.structuralNum - b.structuralNum);
        group.forEach((m, i) => { m.matchNumber = i + 1; });
    }

    const bracketRank = { winners: 0, losers: 1, grand_final: 2 };
    return list
        .sort(
            (a, b) =>
                bracketRank[a.bracket] - bracketRank[b.bracket] ||
                a.roundNumber - b.roundNumber ||
                a.matchNumber - b.matchNumber
        )
        .map(({ structuralRound, structuralNum, ...m }) => m);
    }

module.exports = { buildDoubleElimination, MIN_PARTICIPANTS, MAX_PARTICIPANTS };