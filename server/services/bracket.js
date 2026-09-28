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

module.exports = { getBracketSize, generateSeedOrder };