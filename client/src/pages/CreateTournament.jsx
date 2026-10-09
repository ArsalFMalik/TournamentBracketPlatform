import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getGameTypes, createTournament } from '../api/tournaments';

export default function CreateTournament() {
    const [name, setName] = useState('');
    const [gameTypeId, setGameTypeId] = useState('');
    const [maxParticipants, setMaxParticipants] = useState(8);
    const [setsToWin, setSetsToWin] = useState(1);
    const [target, setTarget] = useState('');
    const [winBy, setWinBy] = useState('');
    const navigate = useNavigate();

    const { data: gameTypesData, isLoading } = useQuery({
        queryKey: ['gameTypes'],
        queryFn: getGameTypes,
    });

    const mutation = useMutation({
        mutationFn: createTournament, 
        onSuccess: (data) => { navigate(`/tournaments/${data.tournament.id}`); }
    });

    const selectedGame = gameTypesData?.gameTypes.find((g) => g.id === gameTypeId);
    const isTargetScore = selectedGame?.scoringFormat === 'target_score';

    function handleGameChange(e) {
        const id = e.target.value;
        setGameTypeId(id);
        const game = gameTypesData?.gameTypes.find((g) => g.id === id);
        setTarget(game?.config?.defaultTarget ?? '');
        setWinBy(game?.config?.defaultWinBy ?? '');
    }

    function handleSubmit(e) {
        e.preventDefault();
        const scoringConfig = { setsToWin: Number(setsToWin) };
        if (isTargetScore) {
            scoringConfig.target = Number(target);
            scoringConfig.winBy = Number(winBy);
        }
        mutation.mutate({
            name,
            gameTypeId,
            maxParticipants: Number(maxParticipants),
            scoringConfig,
        });
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
                    onChange={handleGameChange}
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

                <label className="text-sm text-gray-600">
                    Sets to win (1 = a single game decides the match)
                    <input
                        className="border p-2 rounded w-full mt-1"
                        type="number"
                        min="1"
                        value={setsToWin}
                        onChange={(e) => setSetsToWin(e.target.value)}
                    />
                </label>

                {isTargetScore && (
                    <div className="flex gap-2">
                        <label className="text-sm text-gray-600 flex-1">
                            Target score
                            <input
                                className="border p-2 rounded w-full mt-1"
                                type="number"
                                min="1"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                            />
                        </label>
                        <label className="text-sm text-gray-600 flex-1">
                            Win by
                            <input
                                className="border p-2 rounded w-full mt-1"
                                type="number"
                                min="1"
                                value={winBy}
                                onChange={(e) => setWinBy(e.target.value)}
                            />
                        </label>
                    </div>
                )}

                <button
                    type="submit"
                    className="bg-blue-600 text-white p-2 rounded"
                    disabled={mutation.isPending || !gameTypeId}
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