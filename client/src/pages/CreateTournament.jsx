import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getGameTypes, createTournament } from '../api/tournaments';

export default function CreateTournament() {
    const [name, setName] = useState('');
    const [gameTypeId, setGameTypeId] = useState('');
    const [maxParticipants, setMaxParticipants] = useState(8);
    const navigate = useNavigate();

    const { data: gameTypesData, isLoading } = useQuery({
        queryKey: ['gameTypes'],
        queryFn: getGameTypes,
    });

    const mutation = useMutation({
        mutationFn: createTournament,
        onSuccess: (data) => {
            navigate(`/tournaments/${data.tournament.id}`);
        },
    });

    function handleSubmit(e) {
        e.preventDefault();
        mutation.mutate({ name, gameTypeId, maxParticipants: Number(maxParticipants) });
    }

    if (isLoading) return <div className="p-8">Loading game types...</div>;

    return (
        <div className="max-w-sm mx-auto mt-16 p-6 border rounded-lg">
            <h1 className="text-xl font-bold mb-4">Create Tournament</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                    className="border p-2 rounded"
                    placeholder="Tournament name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <select
                    className="border p-2 rounded"
                    value={gameTypeId}
                    onChange={(e) => setGameTypeId(e.target.value)}
                >
                    <option value="">Select a game</option>
                    {gameTypesData?.gameTypes.map((gt) => (
                        <option key={gt.id} value={gt.id}>{gt.name}</option>
                    ))}
                </select>
                <input
                    className="border p-2 rounded"
                    type="number"
                    min="2"
                    placeholder="Max participants"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                />
                <button
                    type="submit"
                    className="bg-blue-600 text-white p-2 rounded"
                    disabled={mutation.isPending}
                >
                    {mutation.isPending ? 'Creating...' : 'Create Tournament'}
                </button>
                {mutation.isError && (
                    <p className="text-red-600 text-sm">
                        {mutation.error?.response?.data?.error || 'Something went wrong.'}
                    </p>
                )}
            </form>
        </div>
    );
}