const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/tournaments/:tournamentId/join', requireAuth, async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { participants: true },
        });
        if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
        if (tournament.status !== 'registration') {
            return res.status(400).json({ error: 'Registration is closed for this tournament.' });
        }
        if (tournament.participants.length >= tournament.maxParticipants) {
            return res.status(400).json({ error: 'Tournament is full.' });
        }

        const alreadyJoined = tournament.participants.some(p => p.userId === req.user.userId);
        if (alreadyJoined) {
            return res.status(409).json({ error: 'You are already registered for this tournament.' });
        }

        const participant = await prisma.participant.create({
            data: { tournamentId, userId: req.user.userId },
            include: { user: { select: { id: true, username: true } } },
        });

        res.status(201).json({ participant });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong joining the tournament.' });
    }
});

router.post('/tournaments/:tournamentId/participants', requireAuth, async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { displayName } = req.body;

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { participants: true },
        });
        if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
        if (tournament.createdById !== req.user.userId) {
            return res.status(403).json({ error: 'Only the tournament creator can add participants.' });
        }
        if (tournament.participants.length >= tournament.maxParticipants) {
            return res.status(400).json({ error: 'Tournament is full.' });
        }
        if (!displayName) {
            return res.status(400).json({ error: 'displayName is required for manually added participants.' });
        }

        const matchingUser = await prisma.user.findFirst({
            where: { username: {equals: displayName, mode: 'insensitive' } },
        });
        if (matchingUser) {
            return res.status(409).json({ error: 'This name is already taken by a registered user.' });
        }

        const duplicateName = tournament.participants.some(
            p => p.displayName?.toLowerCase() === displayName.toLowerCase()
        );
        if (duplicateName) {
            return res.status(409).json({ error: 'A participant with this name is already registered.' });
        }

        const participant = await prisma.participant.create({
            data: { tournamentId, displayName },
        });

        res.status(201).json({ participant });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong adding the participant.' });
    }
});

module.exports = router;