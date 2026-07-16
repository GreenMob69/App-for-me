/**
 * theme/index.js — sistem de design tokens
 *
 * Sursa unică de adevăr pentru toate valorile vizuale din aplicație.
 * Niciun fișier din aplicație nu conține valori hardcodate de culori,
 * spațiere, tipografie, raze sau umbre — toate importă din acest fișier.
 *
 * Paleta: "Instrument" — cool blue-black, accent electric blue, semantic status colors.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CULORI
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
    // Suprafețe (6 niveluri, de la cel mai întunecat la cel mai ridicat)
    bg: {
        0: '#07080e',   // fundal principal ecran
        1: '#0c0e17',   // suprafață card
        2: '#121520',   // suprafață ridicată (input, row selected)
        3: '#191d2b',   // modal, bottom sheet
        4: '#212638',   // hover / pressed state
        5: '#2a2f45',   // tooltip, popover
    },

    // Borduri (3 niveluri)
    border: {
        subtle:  '#15192a',
        default: '#1f2438',
        strong:  '#2e3555',
    },

    // Text (5 niveluri)
    text: {
        primary:   '#eef0f8',
        secondary: '#8b96b5',
        tertiary:  '#525d7a',
        disabled:  '#31384f',
        inverse:   '#07080e',
    },

    // Accent principal
    accent: {
        default: '#4d8ef5',
        hover:   '#6aa3ff',
        muted:   'rgba(77,142,245,0.10)',
        border:  'rgba(77,142,245,0.25)',
    },

    // Culori semantice status vehicul
    status: {
        optimal:  '#2fcfa4',   // 90-100 — stare optimă (teal)
        good:     '#34d172',   // 75-89  — bun, fără acțiune (verde)
        monitor:  '#f0c04a',   // 55-74  — urmărire recomandată (amber)
        caution:  '#f0883e',   // 35-54  — atenție necesară (portocaliu)
        critical: '#f06464',   // 0-34   — acțiune imediată (coral-roșu)
        neutral:  '#8b96b5',   // neutru / monitorizare
    },

    // Fonduri tinted la 8% opacitate (pentru carduri cu status)
    tint: {
        optimal:  'rgba(47,207,164,0.08)',
        good:     'rgba(52,209,114,0.08)',
        monitor:  'rgba(240,192,74,0.08)',
        caution:  'rgba(240,136,62,0.08)',
        critical: 'rgba(240,100,100,0.08)',
        accent:   'rgba(77,142,245,0.08)',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// SPAȚIERE (grid de 4px)
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
    0:  0,
    1:  4,
    2:  8,
    3:  12,
    4:  16,
    5:  20,
    6:  24,
    8:  32,
    10: 40,
    12: 48,
    16: 64,
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — constante fixe
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
    screenPaddingH:  16,   // padding orizontal orice ecran
    cardPadding:     16,   // padding intern card
    cardPaddingV:    14,   // padding vertical intern card
    sectionGap:      12,   // spațiu între carduri consecutive
    sectionTitleGap:  8,   // spațiu între titlu secțiune și primul card
    interSectionGap: 28,   // spațiu între secțiuni diferite
    tabBarHeight:    58,
    headerHeight:    52,
};

// ─────────────────────────────────────────────────────────────────────────────
// RAZE (border radius)
// ─────────────────────────────────────────────────────────────────────────────

export const radii = {
    xs:   4,
    sm:   8,
    md:   12,   // card standard, input, button
    lg:   16,
    xl:   22,   // card hero, panel principal
    full: 999,  // pill, avatar, progress bar
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOGRAFIE
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
    sizes: {
        display: 52,   // hero gauge (health score principal)
        hero:    36,   // numere mari live dashboard
        title1:  24,   // titlu ecran, modal header
        title2:  20,   // card header primar
        title3:  17,   // subsecțiune, card title secundar
        body1:   15,   // text principal
        body2:   14,   // text card, detalii
        label1:  13,   // labels interactive, butoane
        label2:  12,   // text secundar, descrieri
        caption: 11,   // unități, timestamps, metadata
        micro:   10,   // section headers (UPPERCASE)
    },
    lineHeights: {
        display: 56,
        hero:    40,
        title1:  30,
        title2:  26,
        title3:  22,
        body1:   22,
        body2:   20,
        label1:  18,
        label2:  16,
        caption: 14,
        micro:   13,
    },
    weights: {
        regular:  '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
        heavy:    '800',
    },
    // Toate valorile numerice care se schimbă folosesc tabular-nums
    tabularNums: ['tabular-nums'],
};

// ─────────────────────────────────────────────────────────────────────────────
// MOTION
// ─────────────────────────────────────────────────────────────────────────────

export const motion = {
    duration: {
        instant:  0,    // fără tranziție
        fast:   120,    // micro-interacțiuni (button press, toggle)
        normal: 400,    // animații de intrare standard (fade, slide)
        slow:   600,    // tranziții complexe (card reveal, panel)
        reveal: 800,    // animații principale (gauge arc, health score)
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ICONIȚE
// ─────────────────────────────────────────────────────────────────────────────

export const icons = {
    sizes: {
        xs:  14,
        sm:  18,
        md:  22,
        lg:  28,
        xl:  40,
    },
};
