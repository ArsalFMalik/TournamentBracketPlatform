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

module.exports = { computeRecord };