const express = require('express');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');
const { determineSetWinner, determineMatchWinner } = require('../services/scoring');
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

        if (scoringFormat !== 'binary_result') {
            const valid = sets.every(
                (s) => Number.isInteger(s.p1) && Number.isInteger(s.p2) && s.p1 >= 0 && s.p2 >= 0
            );
            if (!valid) {
                return res.status(400).json({ error: 'Scores must be non-negative whole numbers.' });
            }
        }

        for (const setData of sets) {
            if (determineSetWinner(scoringFormat, effectiveConfig, setData) === null) {
                return res.status(400).json({ error: 'One or more sets are incomplete or invalid for this scoring format.' });
            }
        }

        for (let i = 1; i < sets.length; i++) {
            if (determineMatchWinner(scoringFormat, effectiveConfig, sets.slice(0, i), setsToWin)) {
                return res.status(400).json({ error: 'The match was already decided before the last set entered.' });
            }
        }

        const matchWinner = determineMatchWinner(scoringFormat, effectiveConfig, sets, setsToWin);

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

module.exports = router;