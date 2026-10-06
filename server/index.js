require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const gameTypeRoutes = require('./routes/gameTypes');
const participantRoutes = require('./routes/participants');
const matchRoutes = require('./routes/matches');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', participantRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/game-types', gameTypeRoutes);
app.use('/api/matches', matchRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));