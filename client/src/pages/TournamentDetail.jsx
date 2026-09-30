import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTournament, joinTournament, addParticipant, generateBracket, resetBracket, getMatches } from '../api/tournaments';

export default function TournamentDetail() {
    const { id } = useParams();
    const [guestName, setGuestName] = useState('');
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['tournament', id],
        queryFn: () => getTournament(id),
    });

    const t = data?.tournament;

    const { data: matchesData } = useQuery({
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

    if (isLoading) return <div className="p-8">Loading...</div>;
    if (!t) return <div className="p-8">Tournament not found.</div>;

    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    const isCreator = currentUser?.id === t.createdBy.id;
    const isFull = t.participants.length >= t.maxParticipants;

    return (
        <div className="max-w-2xl mx-auto mt-16 p-6">
            <h1 className="text-xl font-bold">{t.name}</h1>
            <p className="text-sm text-gray-500 mb-4">
                {t.gameType.name} • {t.status} • {t.participants.length}/{t.maxParticipants} participants
            </p>

            {currentUser && !isFull && (
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

            {isCreator && !isFull && (
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
                    {t.participants.map((p) => (
                        <li key={p.id} className="border p-2 rounded text-sm">
                            {p.user?.username || p.displayName || 'Guest'}
                        </li>
                    ))}
                </ul>
            )}

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

            {matchesData && (
                <div className="mt-6">
                    <h2 className="font-semibold mb-2">Matches</h2>
                    {matchesData.matches.map((m) => (
                        <div key={m.id} className="border p-2 rounded text-sm mb-1">
                            Round {m.roundNumber}, Match {m.matchNumber}:{' '}
                            {m.participant1?.user?.username || m.participant1?.displayName || 'TBD'}
                            {' vs '}
                            {m.participant2?.user?.username || m.participant2?.displayName || (m.isBye ? 'BYE' : 'TBD')}
                            {m.status === 'completed' && (
                                <span className="text-green-600">
                                    {' '}— Winner: {m.winner?.user?.username || m.winner?.displayName}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}