import { useState } from 'react';
import { exportAsPng } from '../utils/exportImage';

export default function ExportButton({ targetRef, filename }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleClick() {
        if (!targetRef.current) return;
        setBusy(true);
        setError('');
        try {
            await exportAsPng(targetRef.current, filename);
        } catch (err) {
            console.error(err);
            setError('Could not export the image.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex items-center justify-end gap-2 mb-2">
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
                onClick={handleClick}
                disabled={busy}
                className="text-xs border px-2 py-1 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
            >
                {busy ? 'Exporting...' : 'Download as PNG'}
            </button>
        </div>
    );
}