import { Link } from 'react-router-dom';

function PlayerName({ player }) {
    if (player.userId) {
        return <Link to={`/users/${player.userId}`} className="hover:underline">{player.name}</Link>;
    }
    return <span>{player.name}</span>;
}

function scoreText(m) {
    if (m.unit === 'sets') return `${m.winnerUnits}–${m.loserUnits} in games`;
    const base = `${m.winnerUnits}–${m.loserUnits}`;
    return m.setsPlayed > 1 ? `${base} points over ${m.setsPlayed} sets` : base;
}

export default function MatchHighlight({ match, showTournament = true }) {
    return (
        <div className="border rounded p-3 text-sm">
            <div>
                <span className="font-semibold"><PlayerName player={match.winner} /></span>
                <span className="text-gray-500"> beat </span>
                <PlayerName player={match.loser} />
                <span className="ml-2 font-medium tabular-nums">{scoreText(match)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
                {showTournament && (
                    <>
                        <Link to={`/tournaments/${match.tournamentId}`} className="hover:underline">
                            {match.tournamentName}
                        </Link>
                        {' • '}
                    </>
                )}
                {match.gameType} • Round {match.roundNumber}
            </div>
        </div>
    );
}