function matchResultMetrics(match) {
    if (match.status !== 'completed' || match.isBye || match.isForfeit) return null;
    const sets = match.scoreData?.sets;
    if (!Array.isArray(sets) || sets.length === 0 || !match.winnerId) return null;

    const winnerIsP1 = match.winnerId === match.participant1Id;
    if (!winnerIsP1 && match.winnerId !== match.participant2Id) return null;

    let p1 = 0;
    let p2 = 0;
    let unit;
    if (match.scoringFormat === 'binary_result') {
        unit = 'sets';
        for (const s of sets) {
            if (s.result === 'p1_win') p1++;
            else if (s.result === 'p2_win') p2++;
        }
    } else {
        unit = 'points';
        for (const s of sets) {
            p1 += s.p1 || 0;
            p2 += s.p2 || 0;
        }
    }

    const winnerUnits = winnerIsP1 ? p1 : p2;
    const loserUnits = winnerIsP1 ? p2 : p1;
    const total = winnerUnits + loserUnits;
    if (total === 0) return null;

    return {
        unit,
        winnerUnits,
        loserUnits,
        margin: winnerUnits - loserUnits,
        ratio: (winnerUnits - loserUnits) / total,
        setsPlayed: sets.length,
        informative: unit === 'points' || total >= 2,
    };
}

function rankByMargin(matches, compare, limit) {
    return matches
        .map((m) => ({ id: m.id, metrics: matchResultMetrics(m) }))
        .filter((x) => x.metrics && x.metrics.informative)
        .sort(compare).slice(0, limit)
        .map((x) => ({ id: x.id, ...x.metrics }));
}

function closestMatches(matches, limit = 5) {
    return rankByMargin(
        matches,
        (a, b) => Math.abs(a.metrics.ratio) - Math.abs(b.metrics.ratio) || Math.abs(a.metrics.margin) - Math.abs(b.metrics.margin),
        limit
    );
}

function mostDominantMatches(matches, limit = 5) {
    return rankByMargin(
        matches,
        (a, b) => b.metrics.ratio - a.metrics.ratio || b.metrics.margin - a.metrics.margin,
        limit
    );
}

function averageSetsPerMatch(matches) {
    let count = 0;
    let total = 0;
    for (const m of matches) {
        if (m.status !== 'completed' || m.isBye || m.isForfeit) continue;
        const sets = m.scoreData?.sets;
        if (!Array.isArray(sets) || sets.length === 0) continue;
        count++;
        total += sets.length;
    }
    return { count, average: count ? Math.round((total / count) * 100) / 100 : null };
}

function totalSetsPlayed(matches) {
    let sets = 0;
    let count = 0;
    for (const m of matches) {
        if (m.status !== 'completed' || m.isBye || m.isForfeit) continue;
        const played = m.scoreData?.sets;
        if (!Array.isArray(played) || played.length === 0) continue;
        count++;
        sets += played.length;
    }
    return { matches: count, sets };
}

module.exports = {
    matchResultMetrics,
    closestMatches,
    mostDominantMatches,
    averageSetsPerMatch,
    totalSetsPlayed,
};