/**
 * Brand palette. Lives outside the route tree so screens in route groups
 * can import it without reaching back into a layout file.
 */
export const COLORS = {
  bg: '#FFFFFF',
  surface: '#F4F4F6',
  tile: '#0F0F12',
  ink: '#0F0F12',
  inkMuted: '#6B6B75',
  border: '#E6E6EA',
  mint: '#A1FF75',
  bubblegum: '#FF78CB',
  lilac: '#C9B1FF',
  yellow: '#FFE74A',
  chrome: '#C9CCD4',
  white: '#FFFFFF',

  // Added for the badge/ticket redesign - kept separate from the originals
  // above so nothing that already reads COLORS.* changes behaviour.
  black: '#0B0B0E',
  bubblegumDeep: '#FF3FB0',
  glowPink: 'rgba(255,120,203,0.38)',
  glowMint: 'rgba(161,255,117,0.30)',
  chromeHighlight: '#FFFFFF',
  chromeShadow: '#8B909B',
};

// Diagonal accent bars used in the corner-stripe motif (pink / black / lime).
export const ACCENT_STRIPE = [COLORS.bubblegum, COLORS.black, COLORS.mint];

// Custom display face for wordmarks/headings - loaded via useFonts in
// app/_layout.tsx. Falls back to the system bold font automatically if a
// screen renders before fonts finish loading, since RN just ignores an
// unrecognised fontFamily and uses the platform default.
export const FONT_DISPLAY = 'SpaceGrotesk_700Bold';
export const FONT_DISPLAY_MEDIUM = 'SpaceGrotesk_500Medium';
