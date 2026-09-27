export const fonts = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
};

export const colors = {
  white: '#FFFFFF',
  ink: '#1E0B3B',
  yellow: '#FFD60A',
  orange: '#FF9F1C',
  pink: '#F72585',
  purple: '#7209B7',
  indigo: '#3A0CA3',
  blue: '#4361EE',
  cyan: '#4CC9F0',
  green: '#06D6A0',
  red: '#FF4D6D',
  glass: 'rgba(255,255,255,0.14)',
  glassStrong: 'rgba(255,255,255,0.22)',
  glassBorder: 'rgba(255,255,255,0.28)',
  muted: 'rgba(255,255,255,0.75)',
  faint: 'rgba(255,255,255,0.5)',
};

type Gradient = readonly [string, string, ...string[]];

/** Each screen gets its own backdrop, so screen transitions double as colour shifts. */
export const gradients = {
  welcome: ['#3A0CA3', '#7209B7', '#F72585'],
  menu: ['#240E8B', '#6A0DAD', '#E0217A'],
  lobby: ['#0B3D91', '#4361EE', '#7209B7'],
  collecting: ['#7209B7', '#B5179E', '#F72585'],
  round: ['#1A0B4A', '#3A0CA3', '#7209B7'],
  leaderboard: ['#F72585', '#B5179E', '#560BAD'],
  finished: ['#FF9F1C', '#F72585', '#7209B7'],
  primary: ['#FFE14D', '#FF9F1C'],
  secondary: ['#4CC9F0', '#4361EE'],
  success: ['#2EF2B0', '#06A77D'],
  danger: ['#FF7A8A', '#E0244B'],
} satisfies Record<string, Gradient>;

export const radius = { sm: 12, md: 18, lg: 26, pill: 999 };
