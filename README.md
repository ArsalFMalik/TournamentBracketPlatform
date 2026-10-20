# Tournament Bracket Platform

A game-agnostic tournament management platform supporting single-elimination and round-robin tournaments across multiple sports and esports, through a configurable scoring system rather than hardcoded per-game logic.

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
- **Tournament** — belongs to a game type and a creator, holds `scoringConfig` and a `format` (`single_elimination` or `round_robin`), fixed at creation
- **Team** — optional grouping of participants, scoped per tournament
- **Participant** — a tournament entrant; either a registered `User` or a guest (`displayName` only), optionally grouped under a `Team`; carries a
  `disqualified` flag
- **Match** — belongs to a tournament and stores its results as `scoreData: { sets: [...] }`. In single-elimination, matches link to the next match via `nextMatchId` to form the bracket tree, and `isBye` is tracked separately from regular results. In round-robin, matches have no next match and are grouped into rounds of fixtures. `isForfeit` marks results decided by disqualification

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
- Scoring engine (`determineSetWinner`, `determineMatchWinner`) with one branch per scoring format and full unit test coverage, including drawn sets and win-by-margin handling
- Every match is scored as a list of sets, with `setsToWin` configurable per tournament; a drawn set counts for neither side, so a tied match simply stays undecided until the creator adds another set
- `POST /api/matches/:id/submit-score` (creator only): validates the sets against the tournament's scoring format, decides the winner, and advances them into the next match using the same odd/even slot rule as bracket generation. Completing the final marks the tournament completed
- Guards: byes, matches with an unfilled slot, and completed matches cannot be scored; scores must be non-negative whole numbers; no sets may follow the one that decided the match
- Completion is claimed atomically inside a transaction, so concurrent duplicate submissions can't advance a winner twice
- Frontend: score-entry form that adapts to the scoring format (number inputs, or a win/loss/draw selector), opened from "Enter score" buttons on bracket cards; cards show per-set scores and an "In progress" state for partly-played matches; a champion banner appears once the tournament is completed
- Tournament creation now collects `setsToWin` and, for target-score games, `target` and `winBy` (pre-filled from the game type's defaults)

### Module 4 — Profiles, History, and Admin Tools
- Public player profiles (`GET /api/users/:id/profile`): overall win/loss record and win rate, a per-game breakdown, championships, byes received, and a tournament history showing the result in each (champion, runner-up, eliminated in a given round, disqualified, or in progress). Record and result logic live in a tested pure-function service (`stats.js`)
- Registered usernames link to profiles from the participant list, the bracket, and the round-robin standings; guests have no profile and stay plain text
- Remove/leave participant during registration: the creator can remove anyone, and a registered user can remove their own entry
- Disqualification (creator only, tournament in progress): In single-elimination, the participant's current match is forfeited and the opponent advances. If the opponent isn't known yet, the match forfeits automatically when they arrive, and the cascade continues if the winner then meets another disqualified player. In round-robin, all of the participant's unplayed matches are forfeited, and results already played stand
- Shared advancement service used by score submission, forfeits, and corrections, so winner placement follows one implementation
- Score correction (creator only): In single-elimination, a correction that keeps the same winner is always allowed; one that flips the winner is allowed only while the next match is still pending. In round-robin, corrections are always allowed, since nothing downstream depends on a result. A corrected result must still decide the match. Correcting the final (or the deciding round-robin match) can change the champion
- Frontend: profile page; Disqualify buttons with a confirmation prompt; Correct score on completed matches (reusing the score form in correction mode); forfeit notes and struck-through "DQ" names on the bracket; a format selector on tournament creation; a round-robin view with a standings table and fixtures grouped by round
- Round-robin format (stretch goal, completed): chosen at tournament creation and capped at 16 participants. Fixtures are generated with the circle method, with one participant sitting out each round when the count is odd. Matches are scored with the same sets and `setsToWin` as single-elimination. A live standings table ranks participants by wins, then head-to-head among tied players, then set difference, then point difference, then seed, with disqualified participants listed last. The tournament completes when every match is completed (claimed under a row lock so the final two matches finishing together can't leave it stuck), and the champion is the rank 1 participant. Fixture generation and standings are covered by unit tests

### Module 5 — Analytics Dashboard and Polish

## Design Decisions and Limitations
- Single-elimination and round-robin are supported. Double-elimination and custom game types remain stretch goals
- Guest `displayName`s are checked against existing usernames at add-time, but not retroactively enforced if a user later registers with a name matching an existing guest entry — treated as an acceptable, documented edge case rather than a bug
- Bye wins are not counted toward a player's win/loss record; byes received are shown seperately on profiles
- Draws are allowed per set but never decide a match; a tied match needs extra sets until someone reaches `setsToWin`. This applies to round-robin too, so round-robin standings never contain drawn matches
- Forfeits count as a loss for the disqualified player and a win for the opponent. They are flagged (`isForfeit`) so profiles can show them separately and later analytics can exclude them from upset statistics
- Score corrections in single-elimination are limited: a winner-flipping correction is rejected once the next match has started, since supporting it would mean unwinding downstream results. Forfeited matches, byes, and matches involving a disqualified participant cannot be corrected
- Participants can only be removed during registration; once a bracket is generated, the only way to take someone out is disqualification
- Manual seed ordering is not supported; seeding is always a random shuffle
- Round-robin is capped at 16 participants (120 matches), and the format is fixed once a tournament is created
- Round-robin ties that survive every tiebreaker (wins, head-to-head, set difference, point difference) are decided by seed, which is the random draw. Head-to-head only compares players level on wins, and a three-way cycle falls through to set and point difference
- Forfeits add no set or point data, so they affect wins and losses in the standings but not set or point difference