const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');
const { validateSubmission } = require('../services/scoring');
const { advanceWinner } = require('../services/advancement');

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
        const effectiveConfig = {
            target: config?.defaultTarget,
            winBy: config?.defaultWinBy,
            ...scoringConfig,
        };

        const check = validateSubmission(scoringFormat, effectiveConfig, setsToWin, sets);
        if (check.error) return res.status(400).json({ error: check.error });
        const matchWinner = check.matchWinner;

        const updateData = { scoreData: { sets } };
        if (matchWinner) {
            updateData.status = 'completed';
            updateData.winnerId = matchWinner === 'p1' ? match.participant1Id : match.participant2Id;
        } else {
            updateData.status = 'in_progress';
        }

        await prisma.$transaction(async (tx) => {
            const claim = await tx.match.updateMany({
                where: { id: match.id, status: { not: 'completed' } },
                data: updateData,
            });
            if (claim.count === 0) throw new Error('ALREADY_COMPLETED');
            
            if (matchWinner) {
                await advanceWinner(tx, match, updateData.winnerId);
            }
        }, { timeout: 15000 });

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
        if (err.message === 'ALREADY_COMPLETED') {
            return res.status(400).json({ error: 'This match has already been completed.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong submitting the score.' });
    }
});

router.post('/:id/correct-score', requireAuth, async (req, res) => {
    try {
        const { sets } = req.body;

        const match = await prisma.match.findUnique({
            where: { id: req.params.id },
            include: {
                tournament: { include: { gameType: true } },
                participant1: true,
                participant2: true,
                nextMatch: true,
            },
        });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        if (match.tournament.createdById !== req.user.userId) {
            return res.status(403).json({ error: 'Only the tournament creator can correct scores.' });
        }
        if (match.isBye) {
            return res.status(400).json({ error: 'Bye matches have no score to correct.' });
        }
        if (match.isForfeit) {
            return res.status(400).json({ error: 'Forfeited matches cannot be corrected.' });
        }
        if (match.status !== 'completed') {
            return res.status(400).json({ error: 'Only completed matches can be corrected. Use submit-score for matches that have not finished.' });
        }
        if (match.participant1?.disqualified || match.participant2?.disqualified) {
            return res.status(400).json({ error: 'A match involving a disqualified participant cannot be corrected.' });
        }

        const { scoringFormat, config } = match.tournament.gameType;
        const scoringConfig = match.tournament.scoringConfig || {};
        const setsToWin = scoringConfig.setsToWin ?? 1;
        const effectiveConfig = {
            target: config?.defaultTarget,
            winBy: config?.defaultWinBy,
            ...scoringConfig,
        };

        const check = validateSubmission(scoringFormat, effectiveConfig, setsToWin, sets);
        if (check.error) return res.status(400).json({ error: check.error });
        if (!check.matchWinner) {
            return res.status(400).json({ error: 'A corrected result must still decide the match.' });
        }

        const newWinnerId = check.matchWinner === 'p1' ? match.participant1Id : match.participant2Id;
        const flipped = newWinnerId !== match.winnerId;

        if (flipped && match.nextMatch && match.nextMatch.status !== 'pending') {
            return res.status(400).json({ error: 'The next match has already started, so the winner of this match can no longer be changed.' });
        }

        await prisma.$transaction(async (tx) => {
            const claim = await tx.match.updateMany({
                where: { id: match.id, status: 'completed', winnerId: match.winnerId },
                data: { scoreData: { sets }, winnerId: newWinnerId },
            });
            if (claim.count === 0) throw new Error('CONFLICT');

            if (flipped && match.nextMatchId) {
                const slotField = match.matchNumber % 2 === 1 ? 'participant1Id' : 'participant2Id';
                const nextClaim = await tx.match.updateMany({
                    where: { id: match.nextMatchId, status: 'pending' },
                    data: { [slotField]: newWinnerId },
                });
                if (nextClaim.count === 0) throw new Error('NEXT_STARTED');
            }
        }, { timeout: 15000 });

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
        if (err.message === 'CONFLICT') {
            return res.status(409).json({ error: 'This match changed while you were editing it. Reload and try again.' });
        }
        if (err.message === 'NEXT_STARTED') {
            return res.status(400).json({ error: 'The next match has already started, so the winner of this match can no longer be changed.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong correcting the score.' });
    }
});

module.exports = router;