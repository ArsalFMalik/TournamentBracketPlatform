import { toPng } from 'html-to-image';

export function exportFilename(tournament, kind) {
    const slug = tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${slug || 'tournament'}-${kind}.png`;
}

export async function exportAsPng(node, filename) {
    const holder = document.createElement('div');
    holder.style.cssText = `position:fixed;left:-100000px;top:0;background:#fff;width:${node.offsetWidth}px;`;

    const clone = node.cloneNode(true);
    clone.querySelectorAll('[data-export-hide]').forEach((el) => el.remove());
    clone.querySelectorAll('[data-export-only]').forEach((el) => el.classList.remove('hidden'));
    holder.appendChild(clone);
    document.body.appendChild(holder);

    try {
        if (document.fonts?.ready) await document.fonts.ready;

        const largest = Math.max(clone.offsetWidth, clone.offsetHeight);
        const pixelRatio = Math.min(2, 8000 / largest);

        const dataUrl = await toPng(clone, { backgroundColor: '#ffffff', pixelRatio });

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
    } finally {
        holder.remove();
    }
}