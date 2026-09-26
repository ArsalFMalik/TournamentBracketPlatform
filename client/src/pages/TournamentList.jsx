import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTournaments } from '../api/tournaments';

export default function TournamentList() {
    const { data, isLoading } = useQuery({
        queryKey: ['tournaments'],
        queryFn: getTournaments,
    });

    if (isLoading) return <div className="p-8">Loading tournaments...</div>;

    return (
        <div className="max-w-2xl mx-auto mt-16 p-6">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold">Tournaments</h1>
                <Link to="/tournaments/new" className="bg-blue-600 text-white px-3 py-2 rounded text-sm">
                    + Create Tournament
                </Link>
            </div>
            <div className="flex flex-col gap-2">
                {data?.tournaments.map((t) => (
                    <Link
                        key={t.id}
                        to={`/tournaments/${t.id}`}
                        className="border p-3 rounded hover:bg-gray-50"
                    >
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-sm text-gray-500">
                            {t.gameType.name} • {t.participants.length}/{t.maxParticipants} participants • {t.status}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}