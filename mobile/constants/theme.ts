// ─────────────────────────────────────────────────────────────────────────────
// Google Maps UI — Clean, flat light theme
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Surface hierarchy (light theme)
  surface: {
    lowest: '#f8f9fa',   // App background
    base: '#ffffff',     // Cards, banners, modals
    low: '#f1f3f4',      // Secondary surface
    container: '#e8eaed',// Disabled/pressed state
    high: '#dadce0',     // Borders
    highest: '#bdc1c6',
    bright: '#ffffff',
  },

  // Primary Google Blue
  primary: {
    main: '#1a73e8',
    light: '#8ab4f8',
    dim: '#1967d2',
    container: '#e8f0fe',
    onPrimary: '#ffffff',
  },

  // Accents
  purple: '#a142f4',
  blue: '#1a73e8',
  red: '#ea4335',
  amber: '#fbbc04',
  green: '#34a853',

  // Text
  text: {
    primary: '#202124',
    secondary: '#5f6368',
    muted: '#70757a',
    dim: '#80868b',
    onSurface: '#3c4043',
    onSurfaceVariant: '#5f6368',
  },

  // Borders
  border: {
    subtle: '#f1f3f4',
    medium: '#e8eaed',
    outline: '#dadce0',
    ghost: '#bdc1c6',
  },

  // Severity zone colors
  severity: {
    green: { fill: 'rgba(52, 168, 83, 0.2)', stroke: '#34a853' },
    amber: { fill: 'rgba(251, 188, 4, 0.2)', stroke: '#fbbc04' },
    red: { fill: 'rgba(234, 67, 53, 0.2)', stroke: '#ea4335' },
  },
} as const;

/** SOS type → icon, color, label */
export const sosTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
  medical: { icon: 'medkit', color: '#1a73e8', label: 'Medical' },
  fire: { icon: 'flame', color: '#ea4335', label: 'Fire' },
  police: { icon: 'shield-checkmark', color: '#202124', label: 'Police' },
};

/** SOS outcome status → color, label */
export const statusConfig: Record<string, { color: string; label: string }> = {
  resolved: { color: '#34a853', label: 'Responded' },
  responded: { color: '#34a853', label: 'Responded' },
  false_alarm: { color: '#5f6368', label: 'False Alarm' },
  pending: { color: '#fbbc04', label: 'Pending' },
  active: { color: '#ea4335', label: 'Active' },
};

/** KYC status → color, bg, label, icon */
export const kycConfig: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  pending: { color: '#fbbc04', bg: '#fef7e0', label: 'Pending Verification', icon: 'time' },
  verified: { color: '#34a853', bg: '#e6f4ea', label: 'Verified', icon: 'checkmark-circle' },
  rejected: { color: '#ea4335', bg: '#fce8e6', label: 'Rejected', icon: 'close-circle' },
};

/** Zone severity → banner color */
export const severityBannerColors: Record<string, string> = {
  green: '#34a853',
  amber: '#fbbc04',
  red: '#ea4335',
};

/** Radii */
export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

/** Spacing */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Empty to use default Google Maps light style */
export const darkMapStyle: any[] = [];
