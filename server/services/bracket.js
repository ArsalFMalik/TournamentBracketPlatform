function getBracketSize(participantCount) {
    if (!Number.isInteger(participantCount) || participantCount < 2) {
        throw new Error('A bracket needs at least 2 participants.');
    }
    let size = 2;
    while (size < participantCount) size *= 2;
    return size;
}

function generateSeedOrder(size) {
    if (size < 1 || (size & (size - 1)) !== 0) {
        throw new Error('Bracket size must be a power of 2.');
    }
    if (size === 1) return [1];

    const previous = generateSeedOrder(size / 2);
    const result = [];
    for (const seed of previous) {
        result.push(seed);
        result.push(size + 1 - seed);
    }
    return result;
}

function buildBracket(seededParticipants) {
    const count = seededParticipants.length;
    const size = getBracketSize(count);
    const totalRounds = Math.log2(size);
    const order = generateSeedOrder(size);

    const matches = [];
    for (let round = 1; round <= totalRounds; round++) {
        const matchesInRound = size / 2 ** round;
        for (let m = 1; m <= matchesInRound; m++) {
            matches.push({
                roundNumber: round,
                matchNumber: m,
                participant1: null,
                participant2: null,
                winner: null,
                isBye: false,
                status: 'pending',
                next:
                    round < totalRounds
                    ? {
                        roundNumber: round + 1,
                        matchNumber: Math.ceil(m / 2),
                        slot: m % 2 === 1 ? 1 : 2,
                    }
                    : null,
            });
        }
    }

    const byKey = new Map(matches.map((m) => [`${m.roundNumber}-${m.matchNumber}`, m]));

    for (const match of matches.filter((m) => m.roundNumber === 1)) {
        const slotIndex = (match.matchNumber - 1) * 2;
        const p1 = seededParticipants[order[slotIndex] - 1] ?? null;
        const p2 = seededParticipants[order[slotIndex + 1] - 1] ?? null;

        match.participant1 = p1;
        match.participant2 = p2;

        if (p1 === null || p2 === null) {
            match.isBye = true;
            match.winner = p1 ?? p2;
            match.status = 'completed';

            const target = byKey.get(`${match.next.roundNumber}-${match.next.matchNumber}`);
            target[`participant${match.next.slot}`] = match.winner;
        }
    }

    return matches;
}

module.exports = { getBracketSize, generateSeedOrder, buildBracket };