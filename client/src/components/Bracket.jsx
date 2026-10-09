import { useState } from 'react';
import ScoreEntryForm from './ScoreEntryForm';

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
    if (format === 'binary_result') {
        const draws = (match.scoreData?.sets || []).filter((s) => s.result === 'draw').length;
        if (draws > 0) parts.push(`${draws} draw${draws > 1 ? 's' : ''}`);
    }
    if (match.status === 'in_progress') parts.push('In progress');
    return parts.join(' • ');
}

function SlotRow({ label, scores, isWinner, withBorder }) {
    return (
        <div className={`flex items-center justify-between px-3 py-2 ${withBorder ? 'border-b' : ''} ${isWinner ? 'font-semibold bg-green-50' : ''}`}>
            <span className="truncate min-w-0">{label}</span>
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

function MatchCard({ match, format, isLastRound, canScore, onScore }) {
    const p1Winner = match.status === 'completed' && match.winnerId === match.participant1Id;
    const p2Winner = match.status === 'completed' && match.winnerId === match.participant2Id;
    const note = footerNote(match, format);
    const connector = !isLastRound ? 'after:content-[""] after:absolute after:top-1/2 after:-right-8 after:w-8 after:border-t after:border-gray-300' : '';

    return (
        <div>
            <div className={`relative border rounded-md text-sm w-52 bg-white shadow-sm ${connector}`}>
                <SlotRow
                    label={participantLabel(match.participant1, false)}
                    scores={sideScores(match, format, 1)}
                    isWinner={p1Winner}
                    withBorder
                />
                <SlotRow
                    label={participantLabel(match.participant2, match.isBye)}
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
        </div>
    );
}

export default function Bracket({ matches, tournament, isCreator }) {
    const [scoringMatchId, setScoringMatchId] = useState(null);

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

    const scoringMatch = matches.find((m) => m.id === scoringMatchId);
    const closeModal = () => setScoringMatchId(null);

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
                                        onScore={() => setScoringMatchId(m.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {scoringMatch && (
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
                                {roundLabel(scoringMatch.roundNumber, totalRounds)}, Match {scoringMatch.matchNumber}
                            </h3>
                            <button onClick={closeModal} className="text-gray-500 text-sm">✕</button>
                        </div>
                        <p className="text-sm text-gray-600">
                            {participantLabel(scoringMatch.participant1, false)} vs{' '}
                            {participantLabel(scoringMatch.participant2, false)}
                        </p>
                        <ScoreEntryForm
                            key={scoringMatch.id}
                            match={scoringMatch}
                            tournament={tournament}
                            onClose={closeModal}
                        />
                    </div>
                </div>
            )}
        </>
    );
}