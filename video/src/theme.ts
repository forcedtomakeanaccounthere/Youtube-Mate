// Design tokens lifted from the YouTube Mate frontend (tailwind orange/red,
// cream page wash, Inter UI type, Bileha display wordmark, Mestika nav logo).
import { Easing } from 'remotion';

export const C = {
  bg: '#FFF7F1',
  bg2: '#FDEDE3',
  surface: '#FFFFFF',
  ink: '#111827',
  ink2: '#374151',
  muted: '#6B7280',
  line: '#FED7AA',
  orange: '#F97316',
  red: '#DC2626',
  deep: '#9A1B1B',
  night: '#120B0A',
};

export const GRAD = `linear-gradient(90deg, ${C.orange} 0%, ${C.red} 100%)`;
export const UI = 'Inter, "Inter Display", system-ui, sans-serif';
export const DISPLAY = 'Bileha, Inter, serif';
export const LOGO = 'Mestika, Inter, serif';

// Motion personality: friendly-energetic (startup/consumer tool).
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_CAM = Easing.bezier(0.33, 0, 0.15, 1);
export const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
export const SPRING = { damping: 14, mass: 0.8, stiffness: 140 };
export const SPRING_SOFT = { damping: 20, mass: 1, stiffness: 90 };
