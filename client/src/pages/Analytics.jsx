import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOverview } from '../api/analytics';
import MatchHighlight from '../components/MatchHighlight';

const FORMAT_LABELS = {
    all: 'All formats',
    single_elimination: 'Single elimination',
    round_robin: 'Round robin',
};

function Card({ label, children }) {
    return (
        <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-xl font-bold mt-1">{children}</div>
        </div>
    );
}

export default function Analytics() {
    const [avgFormat, setAvgFormat] = useState('all');
    const { data, isLoading, isError } = useQuery({
        queryKey: ['analytics-overview'],
        queryFn: getOverview,
    });

    if (isLoading) return <div className="p-8">Loading...</div>;
    if (isError) return <div className="p-8 text-red-600">Failed to load analytics.</div>;

    const { totals, byGameType, byFormat, averageParticipants, topPlayers, closestMatches, mostDominantMatches } = data;
    const maxTournaments = Math.max(1, ...byGameType.map((g) => g.tournaments));
    const avg = averageParticipants[avgFormat];

    return (
        <div className="max-w-3xl mx-auto mt-16 p-6">
            <Link to="/" className="text-sm text-blue-600">← Tournaments</Link>
            <h1 className="text-2xl font-bold mt-2 mb-4">Analytics</h1>

            {totals.tournaments === 0 ? (
                <p className="text-sm text-gray-500">No tournaments yet. Create one to see statistics here.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Card label="Tournaments">{totals.tournaments}</Card>
                        <Card label="Matches played">{totals.matchesPlayed}</Card>
                        <Card label="Players">{totals.players}</Card>
                        <div className="border rounded-lg p-3 min-w-0">
                            <div className="text-xs text-gray-500">Avg. participants</div>
                            <div className="text-xl font-bold mt-1">{avg === null ? '—' : avg}</div>
                            <select
                                className="mt-1 w-full max-w-full text-xs border rounded px-1 py-0.5"
                                value={avgFormat}
                                onChange={(e) => setAvgFormat(e.target.value)}
                            >
                                {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Average participants counts tournaments whose bracket has been generated.
                    </p>

                    <h2 className="font-semibold mt-6 mb-2">Tournaments by game</h2>
                    <div className="flex flex-col gap-1">
                        {byGameType.map((g) => (
                            <div key={g.name} className="flex items-center gap-2 text-sm">
                                <span className="w-32 shrink-0">{g.name}</span>
                                <div className="flex-1 bg-gray-100 rounded h-4">
                                    <div
                                        className="bg-blue-500 h-4 rounded"
                                        style={{ width: `${(g.tournaments / maxTournaments) * 100}%` }}
                                    />
                                </div>
                                <span className="w-6 text-right tabular-nums">{g.tournaments}</span>
                            </div>
                        ))}
                    </div>

                    <h2 className="font-semibold mt-6 mb-2">Tournaments by format</h2>
                    <div className="grid grid-cols-2 gap-2">
                        <Card label="Single elimination">{byFormat.single_elimination}</Card>
                        <Card label="Round robin">{byFormat.round_robin}</Card>
                    </div>

                    <h2 className="font-semibold mt-6 mb-2">Top players</h2>
                    {topPlayers.players.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No player has completed {topPlayers.minMatches} matches yet.
                        </p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border">
                                    <thead>
                                        <tr className="bg-gray-50 text-left">
                                            <th className="p-2">#</th>
                                            <th className="p-2">Player</th>
                                            <th className="p-2">Record</th>
                                            <th className="p-2">Win rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topPlayers.players.map((p, i) => (
                                            <tr key={p.userId} className="border-t">
                                                <td className="p-2">{i + 1}</td>
                                                <td className="p-2">
                                                    <Link to={`/users/${p.userId}`} className="hover:underline">{p.username}</Link>
                                                </td>
                                                <td className="p-2">{p.wins}W - {p.losses}L</td>
                                                <td className="p-2">{Math.round(p.winRate * 100)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Players with at least {topPlayers.minMatches} completed matches. Byes are excluded; forfeits count.
                            </p>
                        </>
                    )}

                    <h2 className="font-semibold mt-6 mb-2">Closest matches</h2>
                    {closestMatches.length === 0 ? (
                        <p className="text-sm text-gray-500">No scored matches yet.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {closestMatches.map((m) => <MatchHighlight key={m.matchId} match={m} />)}
                        </div>
                    )}

                    <h2 className="font-semibold mt-6 mb-2">Most dominant results</h2>
                    {mostDominantMatches.length === 0 ? (
                        <p className="text-sm text-gray-500">No scored matches yet.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {mostDominantMatches.map((m) => <MatchHighlight key={m.matchId} match={m} />)}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                        Margins are compared as a share of total points (or games, for Chess and Tekken), so different
                        games are comparable. Forfeits, byes, and Chess or Tekken matches decided by one game are left out.
                    </p>
                </>
            )}
        </div>
    );
}