# Tournament Bracket Platform

A game-agnostic tournament management platform supporting single-elimination brackets across multiple sports and esports, through a configurable scoring system rather than hardcoded per-game logic.

## Tech Stack

| Layer      | Technology                                      |
|------------|--------------------------------------------------|
| Frontend   | React + Vite, Tailwind CSS, React Query, React Router |
| Backend    | Node.js, Express, Prisma ORM                    |
| Database   | PostgreSQL (hosted on Railway), JSONB for flexible scoring config |
| Auth       | JWT (jsonwebtoken + bcrypt)                     |

## Project Structure

```
/client     React frontend (Vite)
/server     Express backend, Prisma schema, migrations
```

## Local Setup

### Prerequisites
- Node.js 24.x
- A PostgreSQL database (this project uses Railway)

### Backend
```
cd server
npm install
```
Create a `.env` file in `/server`:
```
DATABASE_URL="your-postgres-connection-string"
JWT_SECRET="a-long-random-string"
PORT=5000
```
Run migrations and seed data:
```
npx prisma migrate dev
npx prisma db seed
```
Start the server:
```
npm run dev
```

### Frontend
```
cd client
npm install
npm run dev
```
Visit `http://localhost:5173`.

### Running backend tests
```
cd server
npm test
```

## Game Types

8 pre-defined game types across 3 configurable scoring formats:

| Game           | Format        | Notes                       |
|----------------|---------------|-----------------------------|
| Basketball     | single_score  |                             |
| Football       | single_score  |                             |
| Counter-Strike | single_score  |                             |
| Valorant       | single_score  |                             |
| Chess          | binary_result |                             |
| Tekken         | binary_result |                             |
| Volleyball     | target_score  | default target 25, win by 2 |
| Table Tennis   | target_score  | default target 11, win by 2 |

Every tournament stores its own `scoringConfig` (e.g. `setsToWin`, `target`, `winBy`), so the same game type can be configured differently per tournament (e.g. Valorant as Bo1 or Bo3). The three scoring formats differ in how a single set's winner is determined: **single_score** sets are won simply by scoring more than the opponent; **binary_result** sets are decided by outcome only (win, loss, or draw), with no numeric score tracked; and **target_score** sets are won by reaching a target score with a required win-by margin (e.g. first to 21, win by 2).

## Data Model (core tables)

- **User** — registered accounts
- **GameType** — the 8 fixed games and their scoring format
- **Tournament** — belongs to a game type and a creator, holds `scoringConfig`
- **Team** — optional grouping of participants, scoped per tournament
- **Participant** — a tournament entrant; either a registered `User` or a guest (`displayName` only), optionally grouped under a `Team`
- **Match** — belongs to a tournament, links to the next match via `nextMatchId` to form the bracket tree, tracks `isBye` separately from regular results

## Module Progress

### Module 1 — Foundations and Game Types
- User authentication (register/login, JWT, bcrypt password hashing)
- 8 pre-defined game types seeded across 3 scoring formats
- Tournament creation (name, game type, max participants, scoring config)
- Participant registration: self-serve join (registered users) and manual guest add (tournament creator only), with duplicate-name protection in both directions where it matters
- Frontend: login/register pages, tournament list/detail/create pages

### Module 2 — Bracket Generation Engine
- Standard tournament seeding algorithm (recursive seed-order generation), with full unit test coverage across multiple bracket sizes
- Bracket-size calculation and bye distribution to top seeds for non-power-of-2 participant counts
- Match tree generation with `nextMatchId` linking, byes pre-resolved and auto-advanced at generation time
- Bracket generation persisted atomically (race-condition-safe via a transaction-scoped status claim) to prevent duplicate brackets from concurrent requests
- Bracket reset (only permitted before any real match has been played)
- Frontend: column-based bracket visualization with round labels (Quarterfinals/Semifinals/Final, counted from the final backward), winner highlighting, and horizontal scroll for large brackets

### Module 3 — Score Entry and Auto-Advancement
Not started.

### Module 4 — Profiles, History, and Admin Tools
Not started.

### Module 5 — Analytics Dashboard and Polish
Not started.

## Design Decisions and Limitations
- Single-elimination only for committed scope; round-robin and double-elimination are stretch goals
- Guest `displayName`s are checked against existing usernames at add-time, but not retroactively enforced if a user later registers with a name matching an existing guest entry — treated as an acceptable, documented edge case rather than a bug
- Bye wins are not counted toward a player's win/loss record (planned for Module 4's profile stats)