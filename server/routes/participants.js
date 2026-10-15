const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');
const { advanceWinner } = require('../services/advancement');

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
    } catch (err) {
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
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong adding the participant.' });
    }
});

router.delete('/tournaments/:tournamentId/participants/:participantId', requireAuth, async (req, res) => {
    try {
        const { tournamentId, participantId } = req.params;

        const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
        if (tournament.status !== 'registration') {
            return res.status(400).json({ error: 'Participants can only be removed during registration.' });
        }

        const participant = await prisma.participant.findUnique({ where: { id: participantId } });
        if (!participant || participant.tournamentId !== tournamentId) {
            return res.status(404).json({ error: 'Participant not found in this tournament.' });
        }

        const isCreator = tournament.createdById === req.user.userId;
        const isSelf = participant.userId === req.user.userId;
        if (!isCreator && !isSelf) {
            return res.status(403).json({ error: 'You can only remove your own entry, unless you created the tournament.' });
        }

        await prisma.participant.delete({ where: { id: participantId } });
        res.json({ message: 'Participant removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong removing the participant.' });
    }
});

router.post('/tournaments/:tournamentId/participants/:participantId/disqualify', requireAuth, async (req, res) => {
    try {
        const { tournamentId, participantId } = req.params;

        const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
        if (tournament.createdById !== req.user.userId) {
            return res.status(403).json({ error: 'Only the tournament creator can disqualify participants.' });
        }
        if (tournament.status !== 'in_progress') {
            return res.status(400).json({ error: 'Participants can only be disqualified while the tournament is in progress.' });
        }

        const participant = await prisma.participant.findUnique({ where: { id: participantId } });
        if (!participant || participant.tournamentId !== tournamentId) {
            return res.status(404).json({ error: 'Participant not found in this tournament.' });
        }
        if (participant.disqualified) {
            return res.status(400).json({ error: 'This participant is already disqualified.' });
        }

        await prisma.$transaction(async (tx) => {
            const claim = await tx.participant.updateMany({
                where: { id: participantId, disqualified: false },
                data: { disqualified: true },
            });
            if (claim.count === 0) throw new Error('ALREADY_DISQUALIFIED');

            const liveMatch = await tx.match.findFirst({
                where: {
                    tournamentId,
                    status: { not: 'completed' },
                    OR: [{ participant1Id: participantId }, { participant2Id: participantId }],
                },
            });
            if (!liveMatch) throw new Error('NOT_IN_BRACKET');

            const opponentId = liveMatch.participant1Id === participantId ? liveMatch.participant2Id : liveMatch.participant1Id;

            if (opponentId) {
                await tx.match.update({
                    where: { id: liveMatch.id },
                    data: { status: 'completed', winnerId: opponentId, isForfeit: true },
                });
                await advanceWinner(tx, liveMatch, opponentId);
            }
        }, { timeout: 15000 });

        res.json({ message: 'Participant disqualified.' });
    } catch (err) {
        if (err.message === 'ALREADY_DISQUALIFIED') {
            return res.status(400).json({ error: 'This participant is already disqualified.' });
        }
        if (err.message === 'NOT_IN_BRACKET') {
            return res.status(400).json({ error: 'This participant has already been eliminated.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong disqualifying the participant.' });
    }
});

module.exports = router;