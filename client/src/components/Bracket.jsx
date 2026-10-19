import { useState } from 'react';
import { Link } from 'react-router-dom';
import ScoreEntryForm from './ScoreEntryForm';
import { roundLabel } from '../utils/rounds';

function participantLabel(p, isByeSlot) {
    if (p) return p.user?.username || p.displayName || 'Unknown';
    return isByeSlot ? 'BYE' : 'TBD';
}

function ParticipantName({ participant, isByeSlot }) {
    if (!participant) return <span>{isByeSlot ? 'BYE' : 'TBD'}</span>;
    const name = participant.user?.username || participant.displayName || 'Unknown';
    const label = participant.userId ? (
        <Link to={`/users/${participant.userId}`} className="hover:underline">{name}</Link>
    ) : (
        <span>{name}</span>
    );
    return (
        <>
            <span className={participant.disqualified ? 'line-through text-gray-400' : ''}>{label}</span>
            {participant.disqualified && <span className="ml-1 text-xs text-red-600">DQ</span>}
        </>
    );
}

function sideScores(match, format, side) {
    const sets = match.scoreData?.sets;
    if (!sets || sets.length === 0) return [];
    if (format === 'binary_result') {
        const key = side === 1 ? 'p1_win' : 'p2_win';
        return [{ value: sets.filter((s) => s.result === key).length, won: false }];
    }
    return sets.map((s) => ({
        value: side === 1 ? s.p1 : s.p2,
        won: side === 1 ? s.p1 > s.p2 : s.p2 > s.p1,
    }));
}

function footerNote(match, format) {
    const parts = [];
    if (match.isForfeit) parts.push('Forfeit');
    if (format === 'binary_result') {
        const draws = (match.scoreData?.sets || []).filter((s) => s.result === 'draw').length;
        if (draws > 0) parts.push(`${draws} draw${draws > 1 ? 's' : ''}`);
    }
    if (match.status === 'in_progress') parts.push('In progress');
    return parts.join(' • ');
}

function SlotRow({ participant, isByeSlot, scores, isWinner, withBorder }) {
    return (
        <div className={`flex items-center justify-between px-3 py-2 ${withBorder ? 'border-b' : ''} ${isWinner ? 'font-semibold bg-green-50' : ''}`}>
            <span className="truncate min-w-0">
                <ParticipantName participant={participant} isByeSlot={isByeSlot}/>
            </span>
            <span className="flex gap-2 ml-2 text-xs tabular-nums">
                {scores.map((sc, i) => (
                    <span key={i} className={sc.won ? 'font-bold' : 'text-gray-500'}>
                        {sc.value}
                    </span>
                ))}
            </span>
        </div>
    );
}

export function MatchCard({ match, format, isLastRound, canScore, canCorrect, onScore, onCorrect }) {
    const p1Winner = match.status === 'completed' && match.winnerId === match.participant1Id;
    const p2Winner = match.status === 'completed' && match.winnerId === match.participant2Id;
    const note = footerNote(match, format);
    const connector = !isLastRound ? 'after:content-[""] after:absolute after:top-1/2 after:-right-8 after:w-8 after:border-t after:border-gray-300' : '';

    return (
        <div>
            <div className={`relative border rounded-md text-sm w-52 bg-white shadow-sm ${connector}`}>
                <SlotRow
                    participant={match.participant1}
                    isByeSlot={false}
                    scores={sideScores(match, format, 1)}
                    isWinner={p1Winner}
                    withBorder
                />
                <SlotRow
                    participant={match.participant2}
                    isByeSlot={match.isBye}
                    scores={sideScores(match, format, 2)}
                    isWinner={p2Winner}
                />
                {note && <div className="px-3 py-1 text-xs text-gray-500 border-t">{note}</div>}
            </div>
            {canScore && (
                <button
                    onClick={onScore}
                    className="mt-1 text-xs border px-2 py-1 rounded bg-white hover:bg-gray-50"
                >
                    {match.status === 'in_progress' ? 'Update score' : 'Enter score'}
                </button>
            )}
            {canCorrect && (
                <button
                    onClick={onCorrect}
                    className="mt-1 text-xs border px-2 py-1 rounded bg-white hover:bg-gray-50"
                >
                    Correct score
                </button>
            )}
        </div>
    );
}

export default function Bracket({ matches, tournament, isCreator }) {
    const [modal, setModal] = useState(null);

    if (!matches || matches.length === 0) return null;

    const format = tournament.gameType.scoringFormat;
    const totalRounds = Math.max(...matches.map((m) => m.roundNumber));
    const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNumber) => ({
        roundNumber,
        matches: matches.filter((m) => m.roundNumber === roundNumber).sort((a, b) => a.matchNumber - b.matchNumber),
    }));

    const canScore = (m) =>
        isCreator &&
        tournament.status === 'in_progress' &&
        !m.isBye &&
        m.participant1Id &&
        m.participant2Id &&
        m.status !== 'completed';

    const canCorrect = (m) =>
        isCreator &&
        m.status === 'completed' &&
        !m.isBye &&
        !m.isForfeit &&
        !m.participant1?.disqualified &&
        !m.participant2?.disqualified;

    const modalMatch = modal ? matches.find((m) => m.id === modal.id) : null;
    const closeModal = () => setModal(null);

    return (
        <>
            <div className="overflow-x-auto">
                <div className="flex gap-8 p-2 min-w-max">
                    {rounds.map(({ roundNumber, matches: roundMatches }) => (
                        <div key={roundNumber} className="flex flex-col">
                            <h3 className="text-sm font-semibold text-gray-600 mb-2">
                                {roundLabel(roundNumber, totalRounds)}
                            </h3>
                            <div className="flex flex-col justify-around flex-1 gap-4">
                                {roundMatches.map((m) => (
                                    <MatchCard
                                        key={m.id}
                                        match={m}
                                        format={format}
                                        isLastRound={roundNumber === totalRounds}
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
                                {roundLabel(modalMatch.roundNumber, totalRounds)}, Match {modalMatch.matchNumber}
                            </h3>
                            <button onClick={closeModal} className="text-gray-500 text-sm">✕</button>
                        </div>
                        <p className="text-sm text-gray-600">
                            {participantLabel(modalMatch.participant1, false)} vs{' '}
                            {participantLabel(modalMatch.participant2, false)}
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