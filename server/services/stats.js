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

function deriveTournamentResult(participant, tournamentStatus, matches) {
    const totalRounds = matches.length ? Math.max(...matches.map((m) => m.roundNumber)) : 0;

    if (tournamentStatus === 'registration' || matches.length === 0) {
        return { result: 'registration', totalRounds };
    }
    if (participant.disqualified) {
        return { result: 'disqualified', totalRounds };
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

module.exports = { computeRecord, deriveTournamentResult };