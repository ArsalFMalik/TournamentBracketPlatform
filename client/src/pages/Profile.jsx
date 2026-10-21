import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProfile } from '../api/users';
import { roundLabel } from '../utils/rounds';

function ordinal(n) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

function resultLabel(t) {
    if (t.result === 'champion') return 'Champion';
    if (t.result === 'eliminated') {
        if (t.eliminatedRound === t.totalRounds) return 'Runner-up';
        return `Eliminated in ${roundLabel(t.eliminatedRound, t.totalRounds)}`;
    }
    if (t.result === 'placed') return `Finished ${ordinal(t.rank)} of ${t.totalParticipants}`;
    if (t.result === 'disqualified') return 'Disqualified';
    if (t.result === 'in_progress') return 'In progress';
    return 'Registration open';
}

function Stat({ label, value }) {
    return (
        <div className="border rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
        </div>
    );
}

export default function Profile() {
    const { id } = useParams();
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['profile', id],
        queryFn: () => getProfile(id),
    });

    if (isLoading) return <div className="p-8">Loading...</div>;
    if (isError) {
        return (
            <div className="p-8 text-red-600">
                {error?.response?.status === 404 ? 'User not found.' : 'Failed to load this profile.'}
            </div>
        );
    }

    const { user, overall, byGame, tournaments } = data;
    const winRate = overall.played > 0 ? Math.round((overall.wins / overall.played) * 100) : null;
    const memberSince = new Date(user.memberSince).toLocaleDateString();

    return (
        <div className="max-w-2xl mx-auto mt-16 p-6">
            <Link to="/" className="text-sm text-blue-600">← Tournaments</Link>
            <h1 className="text-2xl font-bold mt-2">{user.username}</h1>
            <p className="text-sm text-gray-500 mb-4">Member since {memberSince}</p>
            <Link to={`/versus?a=${encodeURIComponent(user.username)}`} className="text-sm text-blue-600">
                Compare with another player
            </Link>

            {overall.tournamentsEntered === 0 ? (
                <p className="text-sm text-gray-500">This player hasn't entered any tournaments yet.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Stat label="Record" value={`${overall.wins}-${overall.losses}`} />
                        <Stat label="Win rate" value={winRate === null ? '—' : `${winRate}%`} />
                        <Stat label="Tournaments" value={overall.tournamentsEntered} />
                        <Stat label="Championships" value={overall.championships} />
                    </div>

                    <div className="text-xs text-gray-500 mt-2 flex flex-col gap-0.5">
                        {overall.played === 0 && <span>No matches played yet.</span>}
                        {(overall.forfeitWins > 0 || overall.forfeitLosses > 0) && (
                            <span>
                                Includes {overall.forfeitWins} forfeit win{overall.forfeitWins === 1 ? '' : 's'} and{' '}
                                {overall.forfeitLosses} forfeit loss{overall.forfeitLosses === 1 ? '' : 'es'}.
                            </span>
                        )}
                        {overall.byes > 0 && (
                            <span>
                                {overall.byes} bye{overall.byes === 1 ? '' : 's'} received (not counted in the record).
                            </span>
                        )}
                    </div>

                    <h2 className="font-semibold mt-6 mb-2">By game</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border">
                            <thead>
                                <tr className="bg-gray-50 text-left">
                                    <th className="p-2">Game</th>
                                    <th className="p-2">Tournaments</th>
                                    <th className="p-2">Record</th>
                                    <th className="p-2">Titles</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byGame.map((g) => (
                                    <tr key={g.gameType} className="border-t">
                                        <td className="p-2">{g.gameType}</td>
                                        <td className="p-2">{g.tournamentsEntered}</td>
                                        <td className="p-2">{g.wins}W - {g.losses}L</td>
                                        <td className="p-2">{g.championships}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h2 className="font-semibold mt-6 mb-2">Tournament history</h2>
                    <div className="flex flex-col gap-2">
                        {tournaments.map((t) => (
                            <Link
                                key={t.tournamentId}
                                to={`/tournaments/${t.tournamentId}`}
                                className="border rounded p-3 hover:bg-gray-50"
                            >
                                <div className="font-medium">{t.tournamentName}</div>
                                <div className="text-sm text-gray-500">
                                    {t.gameType} • {resultLabel(t)}
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}