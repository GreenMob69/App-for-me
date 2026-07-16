/**
 * formatters.js — utilitare de formatare centralizate
 *
 * Toate funcțiile de formatare date, durată, numere și texte
 * se află aici. Niciun ecran sau componentă nu reimplementează
 * local logică de formatare.
 */

/**
 * Formatează o dată ca timp relativ față de acum.
 * Ex: "Chiar acum", "Acum 5 min", "Acum 3h", "Ieri", "Acum 4 zile"
 */
export function formatTimeAgo(dateInput) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Chiar acum';
    if (diffMin < 60) return `Acum ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Acum ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Ieri';
    return `Acum ${diffDays} zile`;
}

/**
 * Formatează o dată completă în format românesc.
 * Ex: "15 iulie 2026"
 */
export function formatDate(dateInput) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/**
 * Formatează o dată ca dată relativă scurtă.
 * Ex: "Astăzi", "Ieri", "Acum 3 zile", "15 iulie"
 */
export function formatRelativeDate(dateInput) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((todayStart - dateStart) / 86400000);
    if (diffDays === 0) return 'Astăzi';
    if (diffDays === 1) return 'Ieri';
    if (diffDays < 7) return `Acum ${diffDays} zile`;
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
}

/**
 * Formatează o durată în secunde ca string lizibil.
 * Ex: "2h 15m", "45m 30s", "12s"
 */
export function formatDuration(seconds) {
    if (seconds == null || isNaN(seconds) || seconds < 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * Calculează și formatează durata dintre două timestamp-uri ISO.
 * Fix pentru bug-ul de aritmetică pe string-uri ISO.
 */
export function formatTripDuration(startInput, endInput) {
    if (!startInput || !endInput) return '—';
    const start = new Date(startInput).getTime();
    const end = new Date(endInput).getTime();
    if (isNaN(start) || isNaN(end)) return '—';
    return formatDuration(Math.round((end - start) / 1000));
}

/**
 * Formatează un număr cu numărul specificat de zecimale.
 * Returnează '—' dacă valoarea este null/undefined/NaN.
 */
export function formatNumber(value, decimals = 0) {
    if (value == null || isNaN(value)) return '—';
    return Number(value).toFixed(decimals);
}

/**
 * Formatează un număr ca distanță în km cu separare mii.
 * Ex: "12.500 km"
 */
export function formatKm(value) {
    if (value == null || isNaN(value)) return '—';
    return `${Number(value).toLocaleString('ro-RO')} km`;
}
