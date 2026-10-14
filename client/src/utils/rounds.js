export function roundLabel(roundNumber, totalRounds) {
    const fromEnd = totalRounds - roundNumber;
    if (fromEnd === 0) return 'Final';
    if (fromEnd === 1) return 'Semifinals';
    if (fromEnd === 2) return 'Quarterfinals';
    return `Round ${roundNumber}`;
}