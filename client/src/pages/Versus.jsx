import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { lookupUser, getVersus } from '../api/users';

function scoreText(m) {
    if (m.isForfeit) return 'forfeit';
        if (m.scoringFormat === 'binary_result') {
        const a = m.sets.filter((s) => s.result === 'a').length;
        const b = m.sets.filter((s) => s.result === 'b').length;
        const draws = m.sets.filter((s) => s.result === 'draw').length;
        return `${a}–${b}${draws ? ` (${draws} draw${draws > 1 ? 's' : ''})` : ''}`;
    }
    return m.sets.map((s) => `${s.a}–${s.b}`).join(', ');
}

function useResolvedUser(username) {
    return useQuery({
        queryKey: ['lookup', username],
        queryFn: () => lookupUser(username),
        enabled: !!username,
        retry: false,
    });
}

const lookupError = (lookup) => lookup.error?.response?.data?.error || 'Could not look up this player.';

export default function Versus() {
    const [params, setParams] = useSearchParams();
    const aName = params.get('a') || '';
    const bName = params.get('b') || '';

    const [aInput, setAInput] = useState(aName);
    const [bInput, setBInput] = useState(bName);
    useEffect(() => {
        setAInput(aName);
        setBInput(bName);
    }, [aName, bName]);

    const aLookup = useResolvedUser(aName);
    const bLookup = useResolvedUser(bName);
    const aUser = aLookup.data?.user;
    const bUser = bLookup.data?.user;
    const sameUser = !!aUser && !!bUser && aUser.id === bUser.id;
    const ready = !!aUser && !!bUser && !sameUser;

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['versus', aUser?.id, bUser?.id],
        queryFn: () => getVersus(aUser.id, bUser.id),
        enabled: ready,
    });

    function handleSubmit(e) {
        e.preventDefault();
        const next = new URLSearchParams();
        if (aInput.trim()) next.set('a', aInput.trim());
        if (bInput.trim()) next.set('b', bInput.trim());
        setParams(next);
    }

    const lookingUp = (aName && aLookup.isLoading) || (bName && bLookup.isLoading);

    return (
        <div className="max-w-2xl mx-auto mt-16 p-6">
            <Link to="/" className="text-sm text-blue-600">← Tournaments</Link>
            <h1 className="text-2xl font-bold mt-2 mb-4">Head-to-head</h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="text-sm text-gray-600 flex-1 min-w-0">
                        Player 1
                        <input
                            className="border p-2 rounded w-full mt-1"
                            placeholder="Username"
                            value={aInput}
                            onChange={(e) => setAInput(e.target.value)}
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                        />
                    </label>
                    <label className="text-sm text-gray-600 flex-1 min-w-0">
                         Player 2
                        <input
                            className="border p-2 rounded w-full mt-1"
                            placeholder="Username"
                            value={bInput}
                            onChange={(e) => setBInput(e.target.value)}
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                        />
                    </label>
                </div>
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded self-start disabled:opacity-50"
                    disabled={!aInput.trim() || !bInput.trim()}
                >
                    Compare
                </button>
            </form>

            {(!aName || !bName) && (
                <p className="text-sm text-gray-500 mt-4">Enter two usernames and press Compare.</p>
            )}
            {lookingUp && <p className="text-sm text-gray-500 mt-4">Looking up players...</p>}
            {aName && aLookup.isError && (
                <p className="text-sm text-red-600 mt-4">Player 1: {lookupError(aLookup)}</p>
            )}
            {bName && bLookup.isError && (
                <p className="text-sm text-red-600 mt-4">Player 2: {lookupError(bLookup)}</p>
            )}
            {sameUser && <p className="text-sm text-red-600 mt-4">Pick two different players.</p>}
            {ready && isLoading && <p className="text-sm text-gray-500 mt-4">Loading...</p>}
            {ready && isError && (
                <p className="text-sm text-red-600 mt-4">
                    {error?.response?.data?.error || 'Failed to load this comparison.'}
                </p>
            )}

            {ready && data && (() => {
                const { users: pair, overall, byGame, matches } = data;
                const forfeitCount = overall.aForfeitWins + overall.bForfeitWins;

                if (matches.length === 0) {
                    return (
                        <p className="text-sm text-gray-500 mt-6">
                            {pair.a.username} and {pair.b.username} haven't met in a completed match yet.
                        </p>
                    );
                }

                return (
                    <>
                        <div className="flex items-center justify-center gap-6 border rounded-lg p-4 mt-6">
                            <div className="text-center">
                                <Link to={`/users/${pair.a.id}`} className="font-semibold hover:underline">
                                    {pair.a.username}
                                </Link>
                                <div className="text-3xl font-bold">{overall.aWins}</div>
                            </div>
                            <div className="text-gray-400">–</div>
                            <div className="text-center">
                                <Link to={`/users/${pair.b.id}`} className="font-semibold hover:underline">
                                    {pair.b.username}
                                </Link>
                                <div className="text-3xl font-bold">{overall.bWins}</div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {
                                overall.played === 0
                                    ? 'No scored matches between these players yet.'
                                    : `${overall.played} scored match${overall.played === 1 ? '' : 'es'}.`
                            }
                            {forfeitCount > 0 &&
                                ` ${forfeitCount} forfeit result${forfeitCount === 1 ? '' : 's'} listed below, not counted in the record.`}
                        </p>

                        {byGame.length > 0 && (
                            <>
                                <h2 className="font-semibold mt-6 mb-2">By game</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border">
                                        <thead>
                                            <tr className="bg-gray-50 text-left">
                                                <th className="p-2">Game</th>
                                                <th className="p-2">{pair.a.username}</th>
                                                <th className="p-2">{pair.b.username}</th>
                                                <th className="p-2">Matches</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {byGame.map((g) => (
                                                <tr key={g.gameType} className="border-t">
                                                    <td className="p-2">{g.gameType}</td>
                                                    <td className="p-2">{g.aWins}</td>
                                                    <td className="p-2">{g.bWins}</td>
                                                    <td className="p-2">{g.played}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        <h2 className="font-semibold mt-6 mb-2">Matches</h2>
                        <div className="flex flex-col gap-2">
                            {matches.map((m) => (
                                <Link
                                    key={m.matchId}
                                    to={`/tournaments/${m.tournamentId}`}
                                    className="border rounded p-3 text-sm hover:bg-gray-50"
                                >
                                    <div>
                                        <span className={m.winner === 'a' ? 'font-semibold' : 'text-gray-500'}>
                                            {pair.a.username}
                                        </span>
                                        <span className="mx-2 tabular-nums">{scoreText(m)}</span>
                                        <span className={m.winner === 'b' ? 'font-semibold' : 'text-gray-500'}>
                                            {pair.b.username}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {m.tournamentName} • {m.gameType} •{' '}
                                        {m.format === 'round_robin' ? 'Round robin' : 'Single elimination'} • Round {m.roundNumber}
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Newest tournament first. Scores read from {pair.a.username}'s side first, and the winner is in bold.
                        </p>
                    </>
                );
            })()}
        </div>
    );
}