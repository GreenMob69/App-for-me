/**
 * PARADIGM THEMES & DESIGN TOKENS REGISTRY
 * Sistem strict de izolare a tokenilor vizuali pentru a garanta ca
 * cele 5 paradigme nu se influenteaza reciproc si respecta standardele
 * industriale de ergonomie, contrast si incadrare a textelor.
 */

export const PARADIGM_KEYS = {
  CLASSIC_V2: 'CLASSIC_V2',
  NOTHING_MINIMAL: 'NOTHING_MINIMAL',
  RETRO_AUDI_96: 'RETRO_AUDI_96',
  F1_CYBERDECK: 'F1_CYBERDECK',
  SPATIAL_CANVAS: 'SPATIAL_CANVAS',
};

export const PARADIGM_THEMES = {
  [PARADIGM_KEYS.CLASSIC_V2]: {
    name: 'Classic Diagnostic Hub',
    subtitle: 'Consola Profesionala 12 Taburi',
    bg: '#0A0E17',
    surface: '#111827',
    surfaceBorder: '#1F2937',
    primary: '#00D26A',
    secondary: '#00E5FF',
    accent: '#FFB800',
    danger: '#FF3366',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textMuted: '#4B5563',
    fontFamily: 'System',
    tabularNums: true,
    subAccents: {
      GREEN: '#00D26A',
      CYAN: '#00E5FF',
      AMBER: '#FFB800',
    },
  },

  [PARADIGM_KEYS.NOTHING_MINIMAL]: {
    name: 'Nothing Calm Tech',
    subtitle: 'Zero Distragere & Puncte Dot-Matrix',
    bg: '#000000', // True OLED Black
    surface: '#0B0B0B',
    surfaceBorder: '#1E1E1E',
    primary: '#FFFFFF',
    secondary: '#888888',
    accent: '#D71920', // Nothing Red
    danger: '#D71920',
    textPrimary: '#FFFFFF',
    textSecondary: '#8E8E93',
    textMuted: '#3A3A3C',
    fontFamily: 'monospace',
    tabularNums: true,
    dotGridSize: 14,
    dotColor: '#161616',
    subAccents: {
      RED: '#D71920',
      ACID: '#00FF66',
      MONO: '#FFFFFF',
    },
  },

  [PARADIGM_KEYS.RETRO_AUDI_96]: {
    name: 'Audi A6 C4 1996 Digifiz',
    subtitle: 'Bord Digital VFD & Odometru Mecanic',
    bg: '#050200', // Deep Dark Brown/Amber
    surface: '#150A02',
    surfaceBorder: '#381804',
    primary: '#FF8800', // VFD Amber Glow
    primaryGlow: '#FFA733',
    secondary: '#CC6600',
    accent: '#FF3300',
    danger: '#FF1100',
    ghostSegment: 'rgba(255, 136, 0, 0.07)', // Segmente stinse
    textPrimary: '#FF941A',
    textSecondary: '#B35E00',
    textMuted: '#663300',
    fontFamily: 'monospace',
    tabularNums: true,
    subAccents: {
      AMBER: '#FF8800',
      ROT: '#FF1100',
      VAG: '#33FF33',
    },
  },

  [PARADIGM_KEYS.F1_CYBERDECK]: {
    name: 'F1 & WEC Cyberdeck',
    subtitle: 'Telemetrie de Cursa Zero-Scroll',
    bg: '#030508', // Deep Pitch Navy
    surface: '#080D16',
    surfaceBorder: '#16263D',
    primary: '#00F0FF', // Cyan Neon
    secondary: '#00FF66', // Lime Neon
    accent: '#FFB800', // Amber
    danger: '#FF2A2A', // Crimson Race Alert
    textPrimary: '#E2E8F0',
    textSecondary: '#64748B',
    textMuted: '#334155',
    fontFamily: 'monospace',
    tabularNums: true,
    subAccents: {
      CYAN: '#00F0FF',
      RED: '#FF2A2A',
      LIME: '#00FF66',
    },
  },

  [PARADIGM_KEYS.SPATIAL_CANVAS]: {
    name: 'Spatial 3D Digital Twin',
    subtitle: 'Model Tridimensional cu Fizica Activa',
    bg: '#04070D',
    surface: 'rgba(10, 18, 30, 0.85)',
    surfaceBorder: 'rgba(0, 240, 255, 0.25)',
    primary: '#00F0FF',
    secondary: '#3B82F6',
    accent: '#10B981',
    danger: '#EF4444',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
    fontFamily: 'System',
    tabularNums: true,
    subAccents: {
      CYAN: '#00F0FF',
      GOLD: '#FFB800',
      EMERALD: '#00FF66',
    },
  },
};

/**
 * Standard typography helper for tabular numbers and zero-overflow safety
 */
export const TYPOGRAPHY_PRESETS = {
  tabularNumeric: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  nowrapSafe: {
    numberOfLines: 1,
    ellipsizeMode: 'tail',
  },
};
