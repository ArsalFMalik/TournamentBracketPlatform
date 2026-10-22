export default function ExportHeader({ tournament, champion }) {
    const format = tournament.format === 'round_robin' ? 'Round robin' : 'Single elimination';
    return (
        <div data-export-only className="hidden px-2 pt-2 pb-3">
            <div className="text-lg font-bold">{tournament.name}</div>
            <div className="text-sm text-gray-500">
                {tournament.gameType.name} • {format}
                {champion ? ` • Champion: ${champion}` : ''}
            </div>
        </div>
    );
}