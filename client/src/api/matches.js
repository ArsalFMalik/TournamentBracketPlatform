import api from './client';

export async function submitScore(matchId, sets) {
    const res = await api.post(`/matches/${matchId}/submit-score`, { sets });
    return res.data;
}