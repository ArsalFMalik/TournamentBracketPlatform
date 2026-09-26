const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');

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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching the tournament.' });
    }
});

module.exports = router;