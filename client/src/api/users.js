import api from './client';

export async function getProfile(userId) {
    const res = await api.get(`/users/${userId}/profile`);
    return res.data;
}