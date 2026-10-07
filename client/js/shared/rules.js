// ============================================
// RULES — scoring and game constants shared by client and server.
// ============================================

export const VERSION = '1.0.1';

export const ROUND_OPTIONS = [3, 5, 10, 15, 20];
export const TIME_OPTIONS = [0, 60, 90, 120, 180]; // 0 = no limit
export const MAX_PLAYER_OPTIONS = [2, 4, 6, 8, 10];
export const FINDS_PER_SITE = 5;
export const WRONG_GUESS_PENALTY = 100;

/** Base points for a correct identification, by number of artifacts recovered so far. */
export function basePoints(recovered) {
    if (recovered <= 1) return 500;
    if (recovered === 2) return 400;
    if (recovered === 3) return 300;
    if (recovered === 4) return 200;
    return 100;
}

/** Time bonus: 1 point per whole second remaining (0 when there is no time limit). */
export function timeBonus(secondsRemaining) {
    return Math.max(0, Math.floor(Number(secondsRemaining) || 0));
}

export function pointsForCorrect(recovered, secondsRemaining) {
    return basePoints(recovered) + timeBonus(secondsRemaining);
}

/** Highest score a single site can award — used to sanity-check leaderboard submissions. */
export function maxPointsPerRound() {
    return basePoints(0) + Math.max(...TIME_OPTIONS);
}

export function clampToOption(value, options, fallback) {
    const n = Number(value);
    return options.includes(n) ? n : fallback;
}
