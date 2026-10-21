function computeRecord(matches, participantIds) {
    const ids = new Set(participantIds);
    const record = { wins: 0, losses: 0, played: 0, forfeitWins: 0, forfeitLosses: 0 };

    for (const m of matches) {
        if (m.isBye || m.status !== 'completed' || !m.winnerId) continue;
        if (!ids.has(m.participant1Id) && !ids.has(m.participant2Id)) continue;

        record.played++;
        if (ids.has(m.winnerId)) {
            record.wins++;
            if (m.isForfeit) record.forfeitWins++;
        } else {
            record.losses++;
            if (m.isForfeit) record.forfeitLosses++;
        }
    }

    return record;
}

function deriveTournamentResult(participant, tournamentStatus, matches, roundRobin) {
    const totalRounds = matches.length ? Math.max(...matches.map((m) => m.roundNumber)) : 0;

    if (tournamentStatus === 'registration' || matches.length === 0) {
        return { result: 'registration', totalRounds };
    }
    if (participant.disqualified) {
        return { result: 'disqualified', totalRounds };
    }

    if (roundRobin) {
        if (tournamentStatus !== 'completed') return { result: 'in_progress', totalRounds };
        if (roundRobin.rank === 1) return { result: 'champion', totalRounds };
        return {
            result: 'placed',
            rank: roundRobin.rank,
            totalParticipants: roundRobin.totalParticipants,
            totalRounds,
        };
    }

    const lostMatch = matches.find(
        (m) =>
            m.status === 'completed' &&
            !m.isBye &&
            m.winnerId &&
            m.winnerId !== participant.id &&
            (m.participant1Id === participant.id || m.participant2Id === participant.id)
    );
    if (lostMatch) {
        return { result: 'eliminated', eliminatedRound: lostMatch.roundNumber, totalRounds };
    }

    const final = matches.find((m) => m.roundNumber === totalRounds);
    if (tournamentStatus === 'completed' && final?.winnerId === participant.id) {
        return { result: 'champion', totalRounds };
    }

    return { result: 'in_progress', totalRounds };
}

function computeHeadToHead(matches, aIds, bIds) {
    const a = new Set(aIds);
    const b = new Set(bIds);
    const overall = { aWins: 0, bWins: 0, played: 0, aForfeitWins: 0, bForfeitWins: 0 };
    const games = new Map();
    const results = [];

  for (const m of matches) {
        if (m.isBye || m.status !== 'completed' || !m.winnerId) continue;

        const aIsP1 = a.has(m.participant1Id) && b.has(m.participant2Id);
        const aIsP2 = a.has(m.participant2Id) && b.has(m.participant1Id);
        if (!aIsP1 && !aIsP2) continue;

        const winner = a.has(m.winnerId) ? 'a' : b.has(m.winnerId) ? 'b' : null;
        if (!winner) continue;

        results.push({ id: m.id, winner, aIsP1, isForfeit: !!m.isForfeit });

        if (m.isForfeit) {
            if (winner === 'a') overall.aForfeitWins++;
            else overall.bForfeitWins++;
            continue;
        }

        overall.played++;
        if (!games.has(m.gameType)) {
            games.set(m.gameType, { gameType: m.gameType, aWins: 0, bWins: 0, played: 0 });
        }
        const g = games.get(m.gameType);
        g.played++;
        if (winner === 'a') {
            overall.aWins++;
            g.aWins++;
        } else {
            overall.bWins++;
            g.bWins++;
        }
    }

    const byGame = [...games.values()].sort((x, y) => y.played - x.played || x.gameType.localeCompare(y.gameType));
    return { overall, byGame, results };
}

function orientSets(scoringFormat, sets, aIsP1) {
    return (sets || []).map((s) => {
        if (scoringFormat === 'binary_result') {
            if (s.result === 'draw') return { result: 'draw' };
            const p1Won = s.result === 'p1_win';
            return { result: p1Won === aIsP1 ? 'a' : 'b' };
        }
        return aIsP1 ? { a: s.p1, b: s.p2 } : { a: s.p2, b: s.p1 };
    });
}

module.exports = { computeRecord, deriveTournamentResult, computeHeadToHead, orientSets };