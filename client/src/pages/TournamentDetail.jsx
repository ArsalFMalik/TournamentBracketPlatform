import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTournament } from '../api/tournaments';

export default function TournamentDetail() {
    const { id } = useParams();
    const { data, isLoading } = useQuery({
        queryKey: ['tournament', id],
        queryFn: () => getTournament(id),
    });

    if (isLoading) return <div className="p-8">Loading...</div>;

    const t = data.tournament;

    return (
        <div className="max-w-2xl mx-auto mt-16 p-6">
            <h1 className="text-xl font-bold">{t.name}</h1>
            <p className="text-sm text-gray-500 mb-4">
                {t.gameType.name} • {t.status} • {t.participants.length}/{t.maxParticipants} participants
            </p>
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
        </div>
    );
}