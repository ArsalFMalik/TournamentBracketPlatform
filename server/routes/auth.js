const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required.' });
        }

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
        });
        if (existingUser) {
            return res.status(409).json({ error: 'Username or email already in use.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { username, email, passwordHash },
            select: { id: true, username: true, email: true, createdAt: true },
        });

        res.status(201).json({ user });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong during registration.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email },
            });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong during login.' });
    }
});

module.exports = router;