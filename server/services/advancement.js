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

async function completeRoundRobinIfFinished(tx, tournamentId) {
    await tx.$queryRaw`SELECT id FROM "tournaments" WHERE id = ${tournamentId} FOR UPDATE`;
    const remaining = await tx.match.count({
        where: { tournamentId, status: { not: 'completed' } },
    });
    if (remaining === 0) {
        await tx.tournament.update({
            where: { id: tournamentId },
            data: { status: 'completed' },
        });
    }
}

module.exports = { advanceWinner, completeRoundRobinIfFinished };