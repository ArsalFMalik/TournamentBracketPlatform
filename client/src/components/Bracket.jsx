function participantLabel(p, isByeSlot) {
    if (p) return p.user?.username || p.displayName || 'Unknown';
    return isByeSlot ? 'BYE' : 'TBD';
}

function roundLabel(roundNumber, totalRounds) {
    const fromEnd = totalRounds - roundNumber;
    if (fromEnd === 0) return 'Final';
    if (fromEnd === 1) return 'Semifinals';
    if (fromEnd === 2) return 'Quarterfinals';
    return `Round ${roundNumber}`;
}

function MatchCard({ match }) {
    const p1Winner = match.status === 'completed' && match.winnerId === match.participant1Id;
    const p2Winner = match.status === 'completed' && match.winnerId === match.participant2Id;

    return (
        <div className="border rounded-md text-sm w-48 bg-white">
            <div className={`p-2 border-b ${p1Winner ? 'font-semibold bg-green-50' : ''}`}>
                {participantLabel(match.participant1, false)}
            </div>
            <div className={`p-2 ${p2Winner ? 'font-semibold bg-green-50' : ''}`}>
                {participantLabel(match.participant2, match.isBye)}
            </div>
        </div>
    );
}

export default function Bracket({ matches }) {
    if (!matches || matches.length === 0) return null;

    const totalRounds = Math.max(...matches.map((m) => m.roundNumber));
    const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNumber) => ({
        roundNumber,
        matches: matches.filter((m) => m.roundNumber === roundNumber).sort((a, b) => a.matchNumber - b.matchNumber),
    }));

    return (
        <div className="overflow-x-auto">
            <div className="flex gap-8 p-2 min-w-max">
                {rounds.map(({ roundNumber, matches: roundMatches }) => (
                    <div key={roundNumber} className="flex flex-col">
                        <h3 className="text-sm font-semibold text-gray-600 mb-2">
                            {roundLabel(roundNumber, totalRounds)}
                        </h3>
                        <div
                            className="flex flex-col justify-around flex-1 gap-4"
                        >
                            {roundMatches.map((m) => (<MatchCard key={m.id} match={m}/>))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}