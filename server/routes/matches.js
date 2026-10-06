const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');
const { determineSetWinner, determineMatchWinner } = require('../services/scoring');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/:id/submit-score', requireAuth, async (req, res) => {
    try {
        const { sets } = req.body;

        if (!Array.isArray(sets) || sets.length === 0) {
            return res.status(400).json({ error: 'sets must be a non-empty array.' });
        }

        const match = await prisma.match.findUnique({
            where: { id: req.params.id },
            include: { tournament: { include: { gameType: true } } },
        });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        if (match.tournament.createdById !== req.user.userId) {
            return res.status(403).json({ error: 'Only the tournament creator can submit scores.' });
        }
        if (match.isBye) {
            return res.status(400).json({ error: 'Bye matches are already resolved and cannot be scored.' });
        }
        if (!match.participant1Id || !match.participant2Id) {
            return res.status(400).json({ error: 'This match is not ready to be scored yet (a participant slot is still TBD).' });
        }
        if (match.status === 'completed') {
            return res.status(400).json({ error: 'This match has already been completed.' });
        }

        const { scoringFormat, config } = match.tournament.gameType;
        const scoringConfig = match.tournament.scoringConfig || {};
        const setsToWin = scoringConfig.setsToWin ?? 1;
        const effectiveConfig = { ...config, ...scoringConfig };

        for (const setData of sets) {
            const result = determineSetWinner(scoringFormat, effectiveConfig, setData);
            if (result === null) {
                return res.status(400).json({ error: 'One or more sets are incomplete or invalid for this scoring format.' });
            }
        }

        const matchWinner = determineMatchWinner(scoringFormat, effectiveConfig, sets, setsToWin);

        const updateData = { scoreData: { sets }, };

        if (matchWinner) {
            const winnerParticipantId = matchWinner === 'p1' ? match.participant1Id : match.participant2Id;
            updateData.status = 'completed';
            updateData.winnerId = winnerParticipantId;
        } else {
            updateData.status = 'in_progress';
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedMatch = await tx.match.update({
                where: { id: match.id },
                data: updateData,
            });

            if (matchWinner) {
                if (match.nextMatchId) {
                    const nextMatch = await tx.match.findUnique({ where: { id: match.nextMatchId } });
                    const fillField = nextMatch.participant1Id === null ? 'participant1Id' : 'participant2Id';
                    await tx.match.update({
                        where: { id: match.nextMatchId },
                        data: { [fillField]: updateData.winnerId },
                    });
                } else {
                    await tx.tournament.update({
                        where: { id: match.tournamentId },
                        data: { status: 'completed' },
                    });
                }
            }

            return updatedMatch;
        });

        const fullMatch = await prisma.match.findUnique({
            where: { id: match.id },
            include: {
                participant1: { include: { user: { select: { username: true } } } },
                participant2: { include: { user: { select: { username: true } } } },
                winner: { include: { user: { select: { username: true } } } },
            },
        });

        res.json({ match: fullMatch });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong submitting the score.' });
    }
});

module.exports = router;