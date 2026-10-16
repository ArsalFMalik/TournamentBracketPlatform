function determineSetWinner(scoringFormat, config, setData) {
    if (scoringFormat === 'binary_result') {
        if (setData.result === 'p1_win') return 'p1';
        if (setData.result === 'p2_win') return 'p2';
        if (setData.result === 'draw') return 'draw';
        return null;
    }

    if (scoringFormat === 'single_score') {
        const { p1, p2 } = setData;
        if (typeof p1 !== 'number' || typeof p2 !== 'number') return null;
        if (p1 === p2) return 'draw';
        return p1 > p2 ? 'p1' : 'p2';
    }

    if (scoringFormat === 'target_score') {
        const { p1, p2 } = setData;
        if (typeof p1 !== 'number' || typeof p2 !== 'number') return null;

        const target = config?.target ?? 11;
        const winBy = config?.winBy ?? 2;

        const higher = Math.max(p1, p2);
        const lower = Math.min(p1, p2);
        const reachedTarget = higher >= target;
        const reachedMargin = higher - lower >= winBy;

        if (!reachedTarget || !reachedMargin) return null;
        if (p1 === p2) return null;
        return p1 > p2 ? 'p1' : 'p2';
    }

    throw new Error(`Unknown scoring format: ${scoringFormat}`);
}

function determineMatchWinner(scoringFormat, config, sets, setsToWin) {
    let p1Wins = 0;
    let p2Wins = 0;

    for (const setData of sets) {
        const result = determineSetWinner(scoringFormat, config, setData);
        if (result === null) {
            throw new Error('Cannot determine match winner: a set in the list is incomplete or invalid.');
        }
        if (result === 'p1') p1Wins++;
        if (result === 'p2') p2Wins++;
    }

    if (p1Wins >= setsToWin) return 'p1';
    if (p2Wins >= setsToWin) return 'p2';
    return null;
}

function validateSubmission(scoringFormat, config, setsToWin, sets) {
    if (!Array.isArray(sets) || sets.length === 0) {
        return { error: 'sets must be a non-empty array.' };
    }
    if (!sets.every((s) => s && typeof s === 'object')) {
        return { error: 'Each set must be an object.' };
    }
    if (scoringFormat !== 'binary_result') {
        const valid = sets.every((s) => Number.isInteger(s.p1) && Number.isInteger(s.p2) && s.p1 >= 0 && s.p2 >= 0);
        if (!valid) return { error: 'Scores must be non-negative whole numbers.' };
    }
    for (const s of sets) {
        if (determineSetWinner(scoringFormat, config, s) === null) {
            return { error: 'One or more sets are incomplete or invalid for this scoring format.' };
        }
    }
    for (let i = 1; i < sets.length; i++) {
        if (determineMatchWinner(scoringFormat, config, sets.slice(0, i), setsToWin)) {
            return { error: 'The match was already decided before the last set entered.' };
        }
    }
    return { matchWinner: determineMatchWinner(scoringFormat, config, sets, setsToWin) };
}

module.exports = { determineSetWinner, determineMatchWinner, validateSubmission };