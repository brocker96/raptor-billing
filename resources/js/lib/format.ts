export function bytes(value: number | null | undefined): string {
    if (!value) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(
        units.length - 1,
        Math.floor(Math.log(value) / Math.log(1024)),
    );

    return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function uptime(ms: number | null | undefined): string {
    if (!ms) {
        return '—';
    }
    const m = Math.floor(ms / 60000);
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);

    return d ? `${d} д ${h} год` : h ? `${h} год ${m % 60} хв` : `${m} хв`;
}
