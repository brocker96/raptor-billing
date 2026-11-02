/**
 * JSON POST with the Laravel CSRF cookie, for the few calls that are not page visits.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
    const token = decodeURIComponent(
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] ?? '',
    );
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': token,
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(body),
        credentials: 'same-origin',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errors = (data as { errors?: Record<string, string[]> }).errors;
        throw new Error(
            errors
                ? Object.values(errors)[0][0]
                : ((data as { message?: string }).message ?? 'Помилка'),
        );
    }

    return data as T;
}
