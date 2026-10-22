const SCORING_FORMATS = ['single_score', 'binary_result', 'target_score'];
const MAX_NAME_LENGTH = 40;
const MAX_SETS_TO_WIN = 9;
const MAX_TARGET = 999;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateCustomGame(customGame, scoringConfig) {
    if (!isPlainObject(customGame)) {
        return { error: 'Custom game details are required.' };
    }

    const name = typeof customGame.name === 'string' ? customGame.name.trim().replace(/\s+/g, ' ') : '';
    if (!name) return { error: 'Give the custom game a name.' };
    if (name.length > MAX_NAME_LENGTH) {
        return { error: `The game name can be at most ${MAX_NAME_LENGTH} characters.` };
    }

    const scoringFormat = customGame.scoringFormat;
    if (!SCORING_FORMATS.includes(scoringFormat)) {
        return { error: 'Choose a scoring format.' };
    }

    const cfg = isPlainObject(scoringConfig) ? scoringConfig : {};
    const setsToWin = cfg.setsToWin === undefined ? 1 : cfg.setsToWin;
    if (!Number.isInteger(setsToWin) || setsToWin < 1 || setsToWin > MAX_SETS_TO_WIN) {
        return { error: `Sets to win must be a whole number from 1 to ${MAX_SETS_TO_WIN}.` };
    }

    if (scoringFormat !== 'target_score') {
        return {
            gameType: { name, scoringFormat, config: null },
            scoringConfig: { setsToWin },
        };
    }

    const { target, winBy } = cfg;
    if (!Number.isInteger(target) || target < 1 || target > MAX_TARGET) {
        return { error: `Target score must be a whole number from 1 to ${MAX_TARGET}.` };
    }
    if (!Number.isInteger(winBy) || winBy < 1 || winBy > target) {
        return { error: 'Win by must be a whole number from 1 up to the target score.' };
    }

    return {
        gameType: { name, scoringFormat, config: { defaultTarget: target, defaultWinBy: winBy } },
        scoringConfig: { setsToWin, target, winBy },
    };
}

module.exports = { validateCustomGame, MAX_NAME_LENGTH, MAX_SETS_TO_WIN, MAX_TARGET };