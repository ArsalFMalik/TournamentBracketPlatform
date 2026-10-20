const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { computeRecord } = require('../services/stats');
const { closestMatches, mostDominantMatches } = require('../services/analytics');
const { toAnalyticsMatch, summarizeMatch } = require('../services/matchSummary');

const router = express.Router();
const prisma = new PrismaClient();

const MIN_MATCHES_FOR_RANKING = 5;
const TOP_PLAYERS_LIMIT = 10;
const MATCH_LIST_LIMIT = 5;

function average(values) {
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 10) / 10;
}

router.get('/overview', async (req, res) => {
    try {
        const [
            totalUsers,
            matchesPlayed,
            gameTypes,
            formatGroups,
            generatedTournaments,
            userParticipants,
            matches,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.match.count({ where: { status: 'completed', isBye: false, isForfeit: false } }),
            prisma.gameType.findMany({ include: { _count: { select: { tournaments: true } } } }),
            prisma.tournament.groupBy({ by: ['format'], _count: { _all: true } }),
            prisma.tournament.findMany({
                where: { status: { not: 'registration' } },
                select: { format: true, _count: { select: { participants: true } } },
            }),
            prisma.participant.findMany({
                where: { userId: { not: null } },
                select: { id: true, userId: true, user: { select: { username: true } } },
            }),
            prisma.match.findMany({
                where: { status: 'completed', isBye: false },
                include: {
                    participant1: { include: { user: { select: { username: true } } } },
                    participant2: { include: { user: { select: { username: true } } } },
                    tournament: {
                        select: {
                            id: true,
                            name: true,
                            format: true,
                            gameType: { select: { name: true, scoringFormat: true } },
                        },
                    },
                },
            }),
        ]);

        const byFormat = { single_elimination: 0, round_robin: 0 };
        for (const g of formatGroups) byFormat[g.format] = g._count._all;
        const totalTournaments = Object.values(byFormat).reduce((a, b) => a + b, 0);

        const byGameType = gameTypes
            .map((g) => ({
                name: g.name,
                scoringFormat: g.scoringFormat,
                tournaments: g._count.tournaments,
            }))
            .sort((a, b) => b.tournaments - a.tournaments || a.name.localeCompare(b.name));

        const counts = { all: [], single_elimination: [], round_robin: [] };
        for (const t of generatedTournaments) {
            const n = t._count.participants;
            counts.all.push(n);
            if (counts[t.format]) counts[t.format].push(n);
        }
        const averageParticipants = {
            all: average(counts.all),
            single_elimination: average(counts.single_elimination),
            round_robin: average(counts.round_robin),
        };

        const byParticipant = new Map();
        for (const m of matches) {
            for (const id of [m.participant1Id, m.participant2Id]) {
                if (!id) continue;
                if (!byParticipant.has(id)) byParticipant.set(id, []);
                byParticipant.get(id).push(m);
            }
        }

        const byUser = new Map();
        for (const p of userParticipants) {
            if (!byUser.has(p.userId)) byUser.set(p.userId, { username: p.user.username, ids: [] });
            byUser.get(p.userId).ids.push(p.id);
        }

        const players = [];
        for (const [userId, info] of byUser) {
            const userMatches = info.ids.flatMap((id) => byParticipant.get(id) || []);
            const record = computeRecord(userMatches, info.ids);
            if (record.played >= MIN_MATCHES_FOR_RANKING) {
                players.push({
                    userId,
                    username: info.username,
                    wins: record.wins,
                    losses: record.losses,
                    played: record.played,
                    winRate: Math.round((record.wins / record.played) * 1000) / 1000,
                });
            }
        }
        players.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.played - a.played || a.username.localeCompare(b.username));

        const analyticsMatches = matches.map((m) => toAnalyticsMatch(m, m.tournament.gameType.scoringFormat));
        const byId = new Map(matches.map((m) => [m.id, m]));
        const summarize = (r) => {
            const m = byId.get(r.id);
            return summarizeMatch(m, r, m.tournament);
        };

        res.json({
            totals: { tournaments: totalTournaments, matchesPlayed, players: totalUsers },
            byGameType,
            byFormat,
            averageParticipants,
            topPlayers: { minMatches: MIN_MATCHES_FOR_RANKING, players: players.slice(0, TOP_PLAYERS_LIMIT) },
            closestMatches: closestMatches(analyticsMatches, MATCH_LIST_LIMIT).map(summarize),
            mostDominantMatches: mostDominantMatches(analyticsMatches, MATCH_LIST_LIMIT).map(summarize),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching analytics.' });
    }
});

module.exports = router;