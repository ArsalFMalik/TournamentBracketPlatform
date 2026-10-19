import { useState } from 'react';
import { Link } from 'react-router-dom';
import ScoreEntryForm from './ScoreEntryForm';
import { MatchCard } from './Bracket';

function labelOf(p) {
    return p?.user?.username || p?.displayName || 'Unknown';
}

function StandingName({ row }) {
    const name = row.userId ? (
        <Link to={`/users/${row.userId}`} className="hover:underline">{row.name}</Link>
    ) : (
        <span>{row.name}</span>
    );
    return (
        <>
            <span className={row.disqualified ? 'line-through text-gray-400' : ''}>{name}</span>
            {row.disqualified && <span className="ml-1 text-xs text-red-600">DQ</span>}
        </>
    );
}

export default function RoundRobin({ matches, standings, tournament, isCreator }) {
    const [modal, setModal] = useState(null);

    if (!matches || matches.length === 0 || !standings) return null;

    const format = tournament.gameType.scoringFormat;
    const showPoints = format !== 'binary_result';
    const completed = tournament.status === 'completed';
    const totalRounds = Math.max(...matches.map((m) => m.roundNumber));

    const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNumber) => {
        const roundMatches = matches.filter((m) => m.roundNumber === roundNumber).sort((a, b) => a.matchNumber - b.matchNumber);
        const playing = new Set(roundMatches.flatMap((m) => [m.participant1Id, m.participant2Id]));
        return {
            roundNumber,
            matches: roundMatches,
            sittingOut: standings.filter((s) => !playing.has(s.participantId)),
        };
    });

    const canScore = (m) =>
        isCreator &&
        tournament.status === 'in_progress' &&
        m.participant1Id &&
        m.participant2Id &&
        m.status !== 'completed';

    const canCorrect = (m) =>
        isCreator &&
        m.status === 'completed' &&
        !m.isForfeit &&
        !m.participant1?.disqualified &&
        !m.participant2?.disqualified;

    const modalMatch = modal ? matches.find((m) => m.id === modal.id) : null;
    const closeModal = () => setModal(null);

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                    <thead>
                        <tr className="bg-gray-50 text-left">
                            <th className="p-2">#</th>
                            <th className="p-2">Player</th>
                            <th className="p-2">P</th>
                            <th className="p-2">W</th>
                            <th className="p-2">L</th>
                            <th className="p-2">Sets</th>
                            {showPoints && <th className="p-2">Points</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((row) => (
                            <tr
                                key={row.participantId}
                                className={`border-t ${completed && row.rank === 1 ? 'bg-green-50 font-semibold' : ''}`}
                            >
                                <td className="p-2">{row.rank}</td>
                                <td className="p-2"><StandingName row={row} /></td>
                                <td className="p-2">{row.played}</td>
                                <td className="p-2">{row.wins}</td>
                                <td className="p-2">{row.losses}</td>
                                <td className="p-2">{row.setsWon}-{row.setsLost}</td>
                                {showPoints && <td className="p-2">{row.pointsFor}-{row.pointsAgainst}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-500 mt-1">
                Ranked by wins, then head-to-head, set difference, and point difference. Disqualified players are listed last.
            </p>

            <h3 className="font-semibold mt-6 mb-2">Fixtures</h3>
            <div className="flex flex-col gap-4">
                {rounds.map(({ roundNumber, matches: roundMatches, sittingOut }) => (
                    <div key={roundNumber}>
                        <h4 className="text-sm font-semibold text-gray-600 mb-2">
                            Round {roundNumber}
                            {sittingOut.length > 0 && (
                                <span className="ml-2 font-normal text-xs text-gray-500">
                                    Sitting out: {sittingOut.map((s) => s.name).join(', ')}
                                </span>
                            )}
                        </h4>
                        <div className="flex flex-wrap gap-4">
                            {roundMatches.map((m) => (
                                <MatchCard
                                    key={m.id}
                                    match={m}
                                    format={format}
                                    isLastRound={true}
                                    canScore={canScore(m)}
                                    canCorrect={canCorrect(m)}
                                    onScore={() => setModal({ id: m.id, mode: 'score' })}
                                    onCorrect={() => setModal({ id: m.id, mode: 'correct' })}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {modalMatch && (
                <div
                    className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-lg p-4 w-full max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-sm">
                                {modal.mode === 'correct' ? 'Correct score — ' : ''}
                                Round {modalMatch.roundNumber}, Match {modalMatch.matchNumber}
                            </h3>
                            <button onClick={closeModal} className="text-gray-500 text-sm">✕</button>
                        </div>
                        <p className="text-sm text-gray-600">
                            {labelOf(modalMatch.participant1)} vs {labelOf(modalMatch.participant2)}
                        </p>
                        <ScoreEntryForm
                            key={`${modalMatch.id}-${modal.mode}`}
                            match={modalMatch}
                            tournament={tournament}
                            mode={modal.mode}
                            onClose={closeModal}
                        />
                    </div>
                </div>
            )}
        </>
    );
}