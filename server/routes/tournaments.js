const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');
const { buildBracket } = require('../services/bracket')

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', requireAuth, async (req, res) => {
    try {
        const { name, gameTypeId, maxParticipants, scoringConfig } = req.body;

        if (!name || !gameTypeId || !maxParticipants) {
            return res.status(400).json({ error: 'name, gameTypeId, and maxParticipants are required.' });
        }

        const gameType = await prisma.gameType.findUnique({ where: { id: gameTypeId } });
        if (!gameType) {
            return res.status(404).json({ error: 'Game type not found.' });
        }

        const tournament = await prisma.tournament.create({
            data: {
                name,
                gameTypeId,
                maxParticipants,
                scoringConfig: scoringConfig || { setsToWin: 1 },
                createdById: req.user.userId,
            },
            include: { gameType: true, createdBy: { select: { id: true, username: true } } },
        });

        res.status(201).json({ tournament });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong creating the tournament.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const tournaments = await prisma.tournament.findMany({
            include: {
                gameType: true,
                createdBy: { select: { id: true, username: true } },
                participants: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ tournaments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching tournaments.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const tournament = await prisma.tournament.findUnique({
            where: { id: req.params.id },
            include: {
                gameType: true,
                createdBy: { select: { id: true, username: true } },
                participants: { include: { user: { select: { id: true, username: true } }, team: true } },
                teams: true,
            },
        });

        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found.' });
        }

        res.json({ tournament });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching the tournament.' });
    }
});

router.get('/:id/matches', async (req, res) => {
    try {
        const matches = await prisma.match.findMany({
            where: { tournamentId: req.params.id },
            include: {
                participant1: { include: { user: { select: { username: true } } } },
                participant2: { include: { user: { select: { username: true } } } },
                winner: { include: { user: { select: { username: true } } } },
            },
            orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
        });
        res.json({ matches });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching matches.' });
    }
});

router.post('/:id/generate-bracket', requireAuth, async (req, res) => {
    try {
        const tournament = await prisma.tournament.findUnique({
            where: { id: req.params.id },
            include: { participants: true },
        });
        if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
        if (tournament.createdById !== req.user.userId) {
            return res.status(403).json({ error: 'Only the tournament creator can generate the bracket.' });
        }
        if (tournament.status !== 'registration') {
            return res.status(400).json({ error: 'This tournament\'s bracket has already been generated.' });
        }
        if (tournament.participants.length < 2) {
            return res.status(400).json({ error: 'At least 2 participants are required to generate a bracket.' });
        }

        const shuffled = [...tournament.participants];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const template = buildBracket(shuffled.map((p) => p.id));

        const result = await prisma.$transaction(async (tx) => {
            const claim = await tx.tournament.updateMany({
                where: { id: tournament.id, status: 'registration' },
                data: { status: 'in_progress' },
            });
            if (claim.count === 0) {
                throw new Error('ALREADY_GENERATED');
            }

            await Promise.all(
                shuffled.map((p, i) => tx.participant.update({ where: { id: p.id }, data: { seedNumber: i + 1 } }))
            );

            const totalRounds = Math.max(...template.map((m) => m.roundNumber));
            const createdByKey = new Map();

            for (let round = totalRounds; round >= 1; round--) {
                const matchesInRound = template.filter((m) => m.roundNumber === round);
                const rows = await Promise.all(
                    matchesInRound.map((m) => {
                        const nextRow = m.next ? createdByKey.get(`${m.next.roundNumber}-${m.next.matchNumber}`) : null;
                        return tx.match.create({
                            data: {
                                tournamentId: tournament.id,
                                roundNumber: m.roundNumber,
                                matchNumber: m.matchNumber,
                                status: m.status,
                                isBye: m.isBye,
                                participant1Id: m.participant1,
                                participant2Id: m.participant2,
                                winnerId: m.winner,
                                nextMatchId: nextRow ? nextRow.id : null,
                            },
                        });
                    })
                );

                rows.forEach((row) => createdByKey.set(`${round}-${row.matchNumber}`, row));
            }

            await tx.tournament.update({
                where: { id: tournament.id },
                data: { status: 'in_progress' },
            });

            return createdByKey;
        }, { timeout: 15000 }); // some headroom, but the real fix is fewer round trips

        const matches = await prisma.match.findMany({
            where: { tournamentId: tournament.id },
            include: {
                participant1: { include: { user: { select: { username: true } } } },
                participant2: { include: { user: { select: { username: true } } } },
                winner: { include: { user: { select: { username: true } } } },
            },
            orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
        });

        res.status(201).json({ matches });
    } catch (err) {
        if (err.message === 'ALREADY_GENERATED') {
            return res.status(400).json({ error: 'This tournament\'s bracket has already been generated.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong generating the bracket.' });
    }
});

router.post('/:id/reset-bracket', requireAuth, async (req, res) => {
    try {
        const tournament = await prisma.tournament.findUnique({
            where: { id: req.params.id },
            include: { matches: true },
        });
        if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
        if (tournament.createdById !== req.user.userId) {
            return res.status(403).json({ error: 'Only the tournament creator can reset the bracket.' });
        }
        const hasPlayedMatch = tournament.matches.some((m) => m.status === 'completed' && !m.isBye);
        if (hasPlayedMatch) {
            return res.status(400).json({ error: 'Cannot reset after a match has been played.' });
        }

        await prisma.$transaction([
            prisma.match.deleteMany({ where: { tournamentId: tournament.id } }),
            prisma.tournament.update({
                where: { id: tournament.id },
                data: { status: 'registration' },
            }),
        ]);

        res.json({ message: 'Bracket reset.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong resetting the bracket.' });
    }
});

module.exports = router;