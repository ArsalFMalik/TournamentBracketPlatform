import api from './client';

export async function getGameTypes() {
    const res = await api.get('/game-types');
    return res.data;
}

export async function createTournament(data) {
    const res = await api.post('/tournaments', data);
    return res.data;
}

export async function getTournaments() {
    const res = await api.get('/tournaments');
    return res.data;
}

export async function getTournament(id) {
    const res = await api.get(`/tournaments/${id}`);
    return res.data;
}