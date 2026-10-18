function buildRoundRobin(participants) {
    if (participants.length < 2) {
        throw new Error('A round robin needs at least 2 participants.');
    }

    const slots = [...participants];
    if (slots.length % 2 === 1) slots.push(null);
    const size = slots.length;
    const matches = [];

    for (let round = 1; round <= size - 1; round++) {
        let matchNumber = 1;
        for (let i = 0; i < size / 2; i++) {
            const home = slots[i];
            const away = slots[size - 1 - i];
            if (home === null || away === null) continue;
            matches.push({
                roundNumber: round,
                matchNumber: matchNumber++,
                participant1: home,
                participant2: away,
                winner: null,
                isBye: false,
                status: 'pending',
                next: null,
            });
        }
        slots.splice(1, 0, slots.pop());
    }

    return matches;
}

function computeStandings(participants, matches, scoringFormat) {
    const stats = new Map();
    for (const p of participants) {
        stats.set(p.id, {
            participantId: p.id,
            seedNumber: p.seedNumber ?? null,
            disqualified: !!p.disqualified,
            played: 0, wins: 0, losses: 0,
            setsWon: 0, setsLost: 0,
            pointsFor: 0, pointsAgainst: 0,
            headToHead: 0,
        });
    }

    const done = matches.filter((m) => m.status === 'completed' && m.winnerId && !m.isBye);

    for (const m of done) {
        const a = stats.get(m.participant1Id);
        const b = stats.get(m.participant2Id);
        if (!a || !b) continue;

        a.played++;
        b.played++;
        if (m.winnerId === a.participantId) { a.wins++; b.losses++; } else { b.wins++; a.losses++; }

        if (m.isForfeit) continue;

        for (const set of m.scoreData?.sets || []) {
            if (scoringFormat === 'binary_result') {
                if (set.result === 'p1_win') { a.setsWon++; b.setsLost++; }
                else if (set.result === 'p2_win') { b.setsWon++; a.setsLost++; }
            } else {
                if (set.p1 > set.p2) { a.setsWon++; b.setsLost++; }
                else if (set.p2 > set.p1) { b.setsWon++; a.setsLost++; }
                a.pointsFor += set.p1; a.pointsAgainst += set.p2;
                b.pointsFor += set.p2; b.pointsAgainst += set.p1;
            }
        }
    }

    const rows = [...stats.values()];

    const groups = new Map();
    for (const r of rows) {
        const key = `${r.disqualified ? 1 : 0}:${r.wins}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    }
    for (const group of groups.values()) {
        if (group.length < 2) continue;
        const ids = new Set(group.map((r) => r.participantId));
        for (const m of done) {
            if (ids.has(m.participant1Id) && ids.has(m.participant2Id)) {
                const winner = stats.get(m.winnerId);
                if (winner) winner.headToHead++;
            }
        }
    }

    rows.sort(
        (x, y) =>
            Number(x.disqualified) - Number(y.disqualified) ||
            y.wins - x.wins ||
            y.headToHead - x.headToHead ||
            (y.setsWon - y.setsLost) - (x.setsWon - x.setsLost) ||
            (y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst) ||
            (x.seedNumber ?? 1e9) - (y.seedNumber ?? 1e9)
    );

    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

module.exports = { buildRoundRobin, computeStandings };