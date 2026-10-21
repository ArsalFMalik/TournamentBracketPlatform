import { useQuery } from '@tanstack/react-query';
import { getTournamentStats } from '../api/tournaments';
import MatchHighlight from './MatchHighlight';

function Stat({ label, value }) {
    return (
        <div className="border rounded-lg p-3 text-center">
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
        </div>
    );
}

export default function TournamentStats({ tournamentId }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['tournamentStats', tournamentId],
        queryFn: () => getTournamentStats(tournamentId),
    });

    if (isLoading) return <p className="text-sm text-gray-500">Loading stats...</p>;
    if (isError) return <p className="text-sm text-red-600">Failed to load tournament stats.</p>;

    if (data.matchesScored === 0) {
        return (
            <p className="text-sm text-gray-500">
                No scored matches in this tournament, so there are no stats to show.
            </p>
        );
    }

    return (
        <div>
            <div className="grid grid-cols-3 gap-2">
                <Stat label="Matches scored" value={data.matchesScored} />
                <Stat label="Total sets" value={data.totalSets} />
                <Stat label="Avg. sets per match" value={data.averageSetsPerMatch} />
            </div>

            <div className="flex flex-col gap-3 mt-3">
                {data.closestMatch && (
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Closest match</div>
                        <MatchHighlight match={data.closestMatch} showTournament={false} />
                    </div>
                )}
                {data.biggestWin && (
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Biggest win</div>
                        <MatchHighlight match={data.biggestWin} showTournament={false} />
                    </div>
                )}
                {!data.closestMatch && !data.biggestWin && (
                    <p className="text-xs text-gray-500">
                        No match here has a margin to rank, since single-game Chess and Tekken matches are left out.
                    </p>
                )}
            </div>
        </div>
    );
}