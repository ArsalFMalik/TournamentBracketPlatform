import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTournament, joinTournament, addParticipant, removeParticipant, disqualifyParticipant, generateBracket, resetBracket, getMatches } from '../api/tournaments';
import Bracket from '../components/Bracket';
import RoundRobin from '../components/RoundRobin';
import TournamentStats from '../components/TournamentStats';

function statusBadgeClass(status) {
    if (status === 'registration') return 'bg-gray-100 text-gray-700';
    if (status === 'in_progress') return 'bg-green-100 text-green-700';
    if (status === 'completed') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
}

export default function TournamentDetail() {
    const { id } = useParams();
    const [guestName, setGuestName] = useState('');
    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['tournament', id],
        queryFn: () => getTournament(id),
    });

    const t = data?.tournament;

    const { data: matchesData, isError: matchesError } = useQuery({
        queryKey: ['matches', id],
        queryFn: () => getMatches(id),
        enabled: t?.status === 'in_progress' || t?.status === 'completed',
    });

    const joinMutation = useMutation({
        mutationFn: () => joinTournament(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] });
        },
    });

    const addMutation = useMutation({
        mutationFn: () => addParticipant(id, guestName),
        onSuccess: () => {
            setGuestName('');
            queryClient.invalidateQueries({ queryKey: ['tournament', id] });
        },
    });

    const generateMutation = useMutation({
        mutationFn: () => generateBracket(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] });
            queryClient.invalidateQueries({ queryKey: ['matches', id] });
        },
    });

    const resetMutation = useMutation({
        mutationFn: () => resetBracket(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] });
            queryClient.removeQueries({ queryKey: ['matches', id] });
        },
    });

    const removeMutation = useMutation({
        mutationFn: (participantId) => removeParticipant(id, participantId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
    });

    const disqualifyMutation = useMutation({
        mutationFn: (participantId) => disqualifyParticipant(id, participantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] });
            queryClient.invalidateQueries({ queryKey: ['matches', id] });
        },
    });

    if (isLoading) return <div className="p-8">Loading...</div>;
    if (isError) return <div className="p-8 text-red-600">Failed to load this tournament.</div>;
    if (!t) return <div className="p-8">Tournament not found.</div>;

    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    const isCreator = currentUser?.id === t.createdBy.id;
    const isFull = t.participants.length >= t.maxParticipants;
    const isRoundRobin = t.format === 'round_robin';

    const eliminatedIds = new Set();
    if (!isRoundRobin) {
        (matchesData?.matches || []).forEach((m) => {
            if (m.status === 'completed' && !m.isBye && m.winnerId) {
                const loserId = m.winnerId === m.participant1Id ? m.participant2Id : m.participant1Id;
                if (loserId) eliminatedIds.add(loserId);
            }
        });
    }

    return (
        <div className="max-w-2xl mx-auto mt-16 p-6">
            <h1 className="text-xl font-bold">{t.name}</h1>
            <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                {t.gameType.name}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(t.status)}`}>
                    {t.status.replace('_', ' ')}
                </span>
                {t.participants.length}/{t.maxParticipants} participants
            </p>
            <p className="text-xs text-gray-500 mb-4">{isRoundRobin ? 'Round Robin' : 'Single Elimination'}</p>

            {currentUser && !isFull && t.status === 'registration' && (
                <button
                    onClick={() => joinMutation.mutate()}
                    className="bg-blue-600 text-white px-3 py-2 rounded text-sm mb-2"
                    disabled={joinMutation.isPending}
                >
                    {joinMutation.isPending ? 'Joining...' : 'Join Tournament'}
                </button>
            )}
            {joinMutation.isError && (
                <p className="text-red-600 text-sm mb-2">
                    {joinMutation.error?.response?.data?.error}
                </p>
            )}

            {isCreator && !isFull && t.status === 'registration' && (
                <form
                    onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }}
                    className="flex gap-2 mb-4 mt-2"
                >
                    <input
                        className="border p-2 rounded text-sm flex-1"
                        placeholder="Guest name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="bg-gray-700 text-white px-3 py-2 rounded text-sm"
                        disabled={addMutation.isPending}
                    >
                        Add Guest
                    </button>
                </form>
            )}
            {addMutation.isError && (
                <p className="text-red-600 text-sm mb-2">
                    {addMutation.error?.response?.data?.error}
                </p>
            )}

            <h2 className="font-semibold mt-4 mb-2">Participants</h2>
            {t.participants.length === 0 ? (
                <p className="text-sm text-gray-500">No participants yet.</p>
            ) : (
                <ul className="flex flex-col gap-1">
                    {t.participants.map((p) => {
                        const name = p.user?.username || p.displayName || 'Guest';
                        const canRemove = t.status === 'registration' && (isCreator || (currentUser && p.userId === currentUser.id));
                        const canDisqualify = isCreator && t.status === 'in_progress' && !p.disqualified && !eliminatedIds.has(p.id);
                        return (
                            <li key={p.id} className="border p-2 rounded text-sm flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    {p.userId ? (
                                        <Link to={`/users/${p.userId}`} className="hover:underline">{name}</Link>
                                    ) : (
                                        <span>{name}</span>
                                    )}
                                    {p.disqualified && <span className="text-xs text-red-600">Disqualified</span>}
                                    {!p.disqualified && eliminatedIds.has(p.id) && (
                                        <span className="text-xs text-gray-500">Eliminated</span>
                                    )}
                                </span>
                                <span className="flex gap-3">
                                    {canRemove && (
                                        <button
                                            onClick={() => removeMutation.mutate(p.id)}
                                            className="text-xs text-red-600"
                                            disabled={removeMutation.isPending}
                                        >
                                            {isCreator && p.userId !== currentUser?.id ? 'Remove' : 'Leave'}
                                        </button>
                                    )}
                                    {canDisqualify && (
                                        <button
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        isRoundRobin
                                                            ? `Disqualify ${name}? All of their remaining matches will be forfeited. This can't be undone.`
                                                            : `Disqualify ${name}? Their current match will be forfeited. This can't be undone.`
                                                    )
                                                ) {
                                                    disqualifyMutation.mutate(p.id);
                                                }
                                            }}
                                            className="text-xs text-red-600"
                                            disabled={disqualifyMutation.isPending}
                                        >
                                            Disqualify
                                        </button>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            {removeMutation.isError && (
                <p className="text-red-600 text-sm mt-2">{removeMutation.error?.response?.data?.error}</p>
            )}
            {disqualifyMutation.isError && (
                <p className="text-red-600 text-sm mt-2">{disqualifyMutation.error?.response?.data?.error}</p>
            )}

            {t.status === 'completed' && matchesData && (() => {
                const champion = isRoundRobin ? matchesData.standings?.[0]?.name : (() => {
                    const final = matchesData.matches.reduce((a, b) => (b.roundNumber > a.roundNumber ? b : a));
                    return final.winner?.user?.username || final.winner?.displayName;
                })();
                return (
                    <div className="mt-6 p-4 border rounded-lg bg-yellow-50 text-center">
                        <div className="text-xs uppercase tracking-wide text-yellow-700">Champion</div>
                        <div className="text-xl font-bold">{champion}</div>
                    </div>
                );
            })()}

            {isCreator && t.status === 'registration' && t.participants.length >= 2 && (
                <button
                    onClick={() => generateMutation.mutate()}
                    className="bg-green-600 text-white px-3 py-2 rounded text-sm mt-4"
                    disabled={generateMutation.isPending}
                >
                    {generateMutation.isPending ? 'Generating...' : 'Generate Bracket'}
                </button>
            )}
            {generateMutation.isError && (
                <p className="text-red-600 text-sm mt-2">
                    {generateMutation.error?.response?.data?.error}
                </p>
            )}

            {isCreator && t.status === 'in_progress' && (
                <button
                    onClick={() => resetMutation.mutate()}
                    className="bg-red-600 text-white px-3 py-2 rounded text-sm mt-4"
                    disabled={resetMutation.isPending}
                >
                    {resetMutation.isPending ? 'Resetting...' : 'Reset Bracket'}
                </button>
            )}
            {resetMutation.isError && (
                <p className="text-red-600 text-sm mt-2">
                    {resetMutation.error?.response?.data?.error}
                </p>
            )}

            {t.status !== 'registration' && (
                <div className="mt-6">
                    <h2 className="font-semibold mb-2">{isRoundRobin ? 'Standings' : 'Bracket'}</h2>
                    {matchesError ? (
                        <p className="text-sm text-red-600">Failed to load the bracket.</p>
                    ) : !matchesData ? (
                        <p className="text-sm text-gray-500">Loading...</p>
                    ) : isRoundRobin ? (
                        <RoundRobin
                            matches={matchesData.matches}
                            standings={matchesData.standings}
                            tournament={t}
                            isCreator={isCreator}
                        />
                    ) : (
                        <Bracket matches={matchesData.matches} tournament={t} isCreator={isCreator} />
                    )}
                </div>
            )}

            {t.status === 'completed' && (
                <div className="mt-6">
                    <h2 className="font-semibold mb-2">Tournament stats</h2>
                    <TournamentStats tournamentId={t.id} />
                </div>
            )}
        </div>
    );
}