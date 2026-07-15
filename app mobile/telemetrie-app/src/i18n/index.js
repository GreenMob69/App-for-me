import ro from './ro';

const translations = { ro };
let currentLang = 'ro';

export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
    }
}

export function getLanguage() {
    return currentLang;
}

/**
 * Retrieves a translation string by dot-notation path.
 * Supports interpolation: t('urgency.withTimeframe', { days: 14 })
 * Returns the key itself if path not found (helps catch missing keys).
 */
export function t(path, params) {
    const keys = path.split('.');
    let value = translations[currentLang];

    for (const key of keys) {
        if (value == null || typeof value !== 'object') return path;
        value = value[key];
    }

    if (typeof value !== 'string') return path;
    if (!params) return value;

    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return params[key] != null ? String(params[key]) : `{{${key}}}`;
    });
}
