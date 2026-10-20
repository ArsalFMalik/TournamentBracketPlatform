const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { computeRecord, deriveTournamentResult } = require('../services/stats');
const { computeStandings } = require('../services/roundRobin');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/:id/profile', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, username: true, createdAt: true },
        });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const participants = await prisma.participant.findMany({
            where: { userId: user.id },
            include: { tournament: { include: { gameType: true } } },
        });

        const tournamentIds = participants.map((p) => p.tournamentId);
        const matches = tournamentIds.length
            ? await prisma.match.findMany({ where: { tournamentId: { in: tournamentIds } } })
            : [];

        const matchesByTournament = new Map();
        for (const m of matches) {
            if (!matchesByTournament.has(m.tournamentId)) matchesByTournament.set(m.tournamentId, []);
            matchesByTournament.get(m.tournamentId).push(m);
        }

        const rrIds = participants.filter((p) => p.tournament.format === 'round_robin').map((p) => p.tournamentId);
        const rrEntrants = rrIds.length ? await prisma.participant.findMany({ where: { tournamentId: { in: rrIds } } }) : [];
        const entrantsByTournament = new Map();
        for (const e of rrEntrants) {
            if (!entrantsByTournament.has(e.tournamentId)) entrantsByTournament.set(e.tournamentId, []);
            entrantsByTournament.get(e.tournamentId).push(e);
        }

        const history = participants.map((p) => {
            const tMatches = matchesByTournament.get(p.tournamentId) || [];

            let roundRobin;
            if (p.tournament.format === 'round_robin') {
                const table = computeStandings(
                    entrantsByTournament.get(p.tournamentId) || [],
                    tMatches,
                    p.tournament.gameType.scoringFormat
                );
                roundRobin = {
                    rank: table.findIndex((row) => row.participantId === p.id) + 1,
                    totalParticipants: table.length,
                };
            }

            const outcome = deriveTournamentResult(p, p.tournament.status, tMatches, roundRobin);
            return {
                tournamentId: p.tournamentId,
                tournamentName: p.tournament.name,
                gameType: p.tournament.gameType.name,
                status: p.tournament.status,
                createdAt: p.tournament.createdAt,
                ...outcome,
            };
        });
        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const allIds = participants.map((p) => p.id);
        const countByes = (ids) => {
            const set = new Set(ids);
            return matches.filter((m) => m.isBye && set.has(m.winnerId)).length;
        };

        const groups = new Map();
        participants.forEach((p, i) => {
            const key = p.tournament.gameTypeId;
            if (!groups.has(key)) {
                groups.set(key, { gameType: p.tournament.gameType.name, participantIds: [], entries: [] });
            }
            groups.get(key).participantIds.push(p.id);
            groups.get(key).entries.push(history.find((h) => h.tournamentId === p.tournamentId));
        });

        const byGame = [...groups.values()].map((g) => ({
            gameType: g.gameType,
            tournamentsEntered: g.participantIds.length,
            championships: g.entries.filter((e) => e.result === 'champion').length,
            byes: countByes(g.participantIds),
            ...computeRecord(matches, g.participantIds),
        }));
        byGame.sort((a, b) => b.played - a.played);

        res.json({
            user: { id: user.id, username: user.username, memberSince: user.createdAt },
            overall: {
                tournamentsEntered: participants.length,
                championships: history.filter((h) => h.result === 'champion').length,
                byes: countByes(allIds),
                ...computeRecord(matches, allIds),
            },
            byGame,
            tournaments: history,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching the profile.' });
    }
});

module.exports = router;