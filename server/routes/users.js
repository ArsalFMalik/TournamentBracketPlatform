const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { computeRecord, deriveTournamentResult, computeHeadToHead, orientSets } = require('../services/stats');
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
        participants.forEach((p) => {
            const isCustom = p.tournament.gameType.isCustom;
            const key = isCustom ? 'custom' : p.tournament.gameTypeId;
            if (!groups.has(key)) {
                groups.set(key, {
                    gameType: isCustom ? 'Custom' : p.tournament.gameType.name,
                    participantIds: [],
                    entries: [],
                });
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

router.get('/lookup', async (req, res) => {
    try {
        const username = String(req.query.username || '').trim();
        if (!username) return res.status(400).json({ error: 'Enter a username.' });

        const matches = await prisma.user.findMany({
            where: { username: { equals: username, mode: 'insensitive' } },
            select: { id: true, username: true },
            take: 2,
        });

        const exact = matches.find((u) => u.username === username);
        const user = exact || (matches.length === 1 ? matches[0] : null);

        if (!user) {
            return res.status(404).json({
                error: matches.length > 1 ? 'Type the username exactly, including capitalization.'  : 'No player found with that username.',
            });
        }

        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong looking up that player.' });
    }
});

router.get('/:a/versus/:b', async (req, res) => {
    try {
        const { a, b } = req.params;
        if (a === b) return res.status(400).json({ error: 'Pick two different players.' });

        const [userA, userB] = await Promise.all([
            prisma.user.findUnique({ where: { id: a }, select: { id: true, username: true } }),
            prisma.user.findUnique({ where: { id: b }, select: { id: true, username: true } }),
        ]);
        if (!userA || !userB) return res.status(404).json({ error: 'User not found.' });

        const participants = await prisma.participant.findMany({
            where: { userId: { in: [a, b] } },
            select: { id: true, userId: true },
        });
        const aIds = participants.filter((p) => p.userId === a).map((p) => p.id);
        const bIds = participants.filter((p) => p.userId === b).map((p) => p.id);

        const matches = aIds.length && bIds.length
            ? await prisma.match.findMany({
                where: {
                    status: 'completed',
                    isBye: false,
                    OR: [
                        { participant1Id: { in: aIds }, participant2Id: { in: bIds } },
                        { participant1Id: { in: bIds }, participant2Id: { in: aIds } },
                    ],
                },
                include: {
                    tournament: {
                        select: {
                            id: true,
                            name: true,
                            format: true,
                            createdAt: true,
                            gameType: { select: { name: true, scoringFormat: true, isCustom: true } },
                        },
                    },
                },
            }) : [];

            const { overall, byGame, results } = computeHeadToHead(
                matches.map((m) => ({
                    ...m,
                    gameType: m.tournament.gameType.isCustom ? 'Custom' : m.tournament.gameType.name,
                })),
                aIds,
                bIds
            );

        const byId = new Map(matches.map((m) => [m.id, m]));
        const list = results.map((r) => {
            const m = byId.get(r.id);
            const { scoringFormat } = m.tournament.gameType;
            return {
                matchId: m.id,
                tournamentId: m.tournament.id,
                tournamentName: m.tournament.name,
                tournamentCreatedAt: m.tournament.createdAt,
                gameType: m.tournament.gameType.name,
                scoringFormat,
                format: m.tournament.format,
                roundNumber: m.roundNumber,
                matchNumber: m.matchNumber,
                isForfeit: r.isForfeit,
                winner: r.winner,
                sets: r.isForfeit ? [] : orientSets(scoringFormat, m.scoreData?.sets, r.aIsP1),
            };
        });
        list.sort(
            (x, y) =>
                new Date(y.tournamentCreatedAt) - new Date(x.tournamentCreatedAt) ||
                y.roundNumber - x.roundNumber ||
                y.matchNumber - x.matchNumber
        );

        res.json({ users: { a: userA, b: userB }, overall, byGame, matches: list });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching the head-to-head record.' });
    }
});

module.exports = router;