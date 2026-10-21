import api from './client';

export async function getOverview() {
    const res = await api.get('/analytics/overview');
    return res.data;
}