function nameOf(p) {
    return p?.user?.username || p?.displayName || 'Unknown';
}

function toAnalyticsMatch(match, scoringFormat) {
    return {
        id: match.id,
        scoringFormat,
        status: match.status,
        isBye: match.isBye,
        isForfeit: match.isForfeit,
        winnerId: match.winnerId,
        participant1Id: match.participant1Id,
        participant2Id: match.participant2Id,
        scoreData: match.scoreData,
    };
}

function summarizeMatch(match, metrics, tournament) {
    const winnerIsP1 = match.winnerId === match.participant1Id;
    const winner = winnerIsP1 ? match.participant1 : match.participant2;
    const loser = winnerIsP1 ? match.participant2 : match.participant1;
    return {
        matchId: match.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        gameType: tournament.gameType.name,
        format: tournament.format,
        roundNumber: match.roundNumber,
        matchNumber: match.matchNumber,
        winner: { name: nameOf(winner), userId: winner?.userId ?? null },
        loser: { name: nameOf(loser), userId: loser?.userId ?? null },
        unit: metrics.unit,
        winnerUnits: metrics.winnerUnits,
        loserUnits: metrics.loserUnits,
        margin: metrics.margin,
        ratio: Math.round(metrics.ratio * 1000) / 1000,
        setsPlayed: metrics.setsPlayed,
        sets: match.scoreData.sets,
    };
}

module.exports = { toAnalyticsMatch, summarizeMatch };