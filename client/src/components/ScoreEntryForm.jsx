import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitScore } from '../api/matches';

function nameOf(p) {
    return p?.user?.username || p?.displayName || 'Unknown';
}

function emptySet(format) {
    return format === 'binary_result' ? { result: '' } : { p1: '', p2: '' };
}

function toPayload(format, s) {
    return format === 'binary_result' ? { result: s.result } : { p1: Number(s.p1), p2: Number(s.p2) };
}

function isSetFilled(format, s) {
    if (format === 'binary_result') return s.result !== '';
    const valid = (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0;
    return valid(s.p1) && valid(s.p2);
}

export default function ScoreEntryForm({ match, tournament, onClose }) {
    const queryClient = useQueryClient();
    const format = tournament.gameType.scoringFormat;
    const sc = tournament.scoringConfig || {};
    const setsToWin = sc.setsToWin ?? 1;
    const target = sc.target ?? tournament.gameType.config?.defaultTarget;
    const winBy = sc.winBy ?? tournament.gameType.config?.defaultWinBy;

    const [sets, setSets] = useState(() =>
        match.scoreData?.sets?.length
            ? match.scoreData.sets.map((s) =>
                format === 'binary_result' ? { result: s.result } : { p1: String(s.p1), p2: String(s.p2) }
            ) : [emptySet(format)]
    );
    const [clientError, setClientError] = useState('');

    const p1Name = nameOf(match.participant1);
    const p2Name = nameOf(match.participant2);

    const mutation = useMutation({
        mutationFn: () => submitScore(match.id, sets.map((s) => toPayload(format, s))),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches', tournament.id] });
            queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] });
            onClose?.();
        },
    });

    function updateSet(index, field, value) {
        setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    }

    function handleSubmit(e) {
        e.preventDefault();
        if (!sets.every((s) => isSetFilled(format, s))) {
            setClientError('Fill in every set before submitting.');
            return;
        }
        setClientError('');
        mutation.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-gray-500">
                First to {setsToWin} set win{setsToWin > 1 ? 's' : ''}
                {format === 'target_score' && ` • sets go to ${target}, win by ${winBy}`}
                {format === 'binary_result' && ' • draws are allowed per set; add another set to break a tie'}
            </p>

            {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12">Set {i + 1}</span>
                    {format === 'binary_result' ? (
                        <select
                            className="border p-1 rounded text-sm flex-1"
                            value={s.result}
                            onChange={(e) => updateSet(i, 'result', e.target.value)}
                        >
                            <option value="">Select result</option>
                            <option value="p1_win">{p1Name} wins</option>
                            <option value="p2_win">{p2Name} wins</option>
                            <option value="draw">Draw</option>
                        </select>
                    ) : (
                        <>
                            <input
                                className="border p-1 rounded text-sm w-16"
                                type="number"
                                min="0"
                                placeholder={p1Name.slice(0, 6)}
                                value={s.p1}
                                onChange={(e) => updateSet(i, 'p1', e.target.value)}
                            />
                            <span className="text-xs">–</span>
                            <input
                                className="border p-1 rounded text-sm w-16"
                                type="number"
                                min="0"
                                placeholder={p2Name.slice(0, 6)}
                                value={s.p2}
                                onChange={(e) => updateSet(i, 'p2', e.target.value)}
                            />
                            <span className="text-xs text-gray-400">{p1Name} vs {p2Name}</span>
                        </>
                    )}
                </div>
            ))}

            <div className="flex gap-2 mt-1">
                <button
                    type="button"
                    className="text-xs border px-2 py-1 rounded"
                    onClick={() => setSets((prev) => [...prev, emptySet(format)])}
                >
                    + Add set
                </button>
                {sets.length > 1 && (
                    <button
                        type="button"
                        className="text-xs border px-2 py-1 rounded"
                        onClick={() => setSets((prev) => prev.slice(0, -1))}
                    >
                        Remove last set
                    </button>
                )}
                <button
                    type="submit"
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded ml-auto"
                    disabled={mutation.isPending}
                >
                    {mutation.isPending ? 'Submitting...' : 'Submit score'}
                </button>
            </div>

            {clientError && <p className="text-red-600 text-xs">{clientError}</p>}
            {mutation.isError && (
                <p className="text-red-600 text-xs">
                    {mutation.error?.response?.data?.error || 'Something went wrong.'}
                </p>
            )}
        </form>
    );
}