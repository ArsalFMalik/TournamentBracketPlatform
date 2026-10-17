import api from './client';

export async function submitScore(matchId, sets) {
    const res = await api.post(`/matches/${matchId}/submit-score`, { sets });
    return res.data;
}

export async function correctScore(matchId, sets) {
    const res = await api.post(`/matches/${matchId}/correct-score`, { sets });
    return res.data;
}