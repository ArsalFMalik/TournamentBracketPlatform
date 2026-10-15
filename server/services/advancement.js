async function advanceWinner(tx, match, winnerId) {
    if (!match.nextMatchId) {
        await tx.tournament.update({
            where: { id: match.tournamentId },
            data: { status: 'completed' },
        });
        return;
    }

    const slotField = match.matchNumber % 2 === 1 ? 'participant1Id' : 'participant2Id';
    const next = await tx.match.update({
        where: { id: match.nextMatchId },
        data: { [slotField]: winnerId },
        include: { participant1: true, participant2: true },
    });

    if (next.participant1Id && next.participant2Id) {
        const p1Out = next.participant1.disqualified;
        const p2Out = next.participant2.disqualified;
        if (p1Out !== p2Out) {
            const forfeitWinnerId = p1Out ? next.participant2Id : next.participant1Id;
            await tx.match.update({
                where: { id: next.id },
                data: { status: 'completed', winnerId: forfeitWinnerId, isForfeit: true },
            });
            await advanceWinner(tx, next, forfeitWinnerId);
        }
    }
}

module.exports = { advanceWinner };