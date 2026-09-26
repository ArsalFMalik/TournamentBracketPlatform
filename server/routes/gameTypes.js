const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const gameTypes = await prisma.gameType.findMany({ orderBy: { name: 'asc' } });
        res.json({ gameTypes });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching game types.' });
    }
});

module.exports = router;