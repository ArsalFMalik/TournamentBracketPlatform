import api from './client';

export async function getProfile(userId) {
    const res = await api.get(`/users/${userId}/profile`);
    return res.data;
}

export async function lookupUser(username) {
    const res = await api.get('/users/lookup', { params: { username } });
    return res.data;
}

export async function getVersus(a, b) {
    const res = await api.get(`/users/${a}/versus/${b}`);
    return res.data;
}