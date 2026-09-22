import type { Config } from 'tailwindcss';

/**
 * Hygge Pergola design system.
 *
 * The palette mirrors the brand's aluminium-and-Nordic-neutrals look: matt
 * anthracite structure, warm linen and sand surfaces, and a single warm ember
 * accent that echoes the integrated LED lighting. Every value lives here so the
 * whole portal re-skins from one file.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C2022',
        charcoal: '#2B3134',
        anthracite: '#3B4448',
        slate: '#6E7A7F',
        mist: '#C3CACD',
        stone: '#DED6C9',
        sand: '#ECE5DA',
        linen: '#F7F4EF',
        ember: {
          DEFAULT: '#B9763C',
          dark: '#965C2C',
          soft: '#F6EBE0',
          ring: 'rgba(185, 118, 60, 0.28)',
        },
        moss: { DEFAULT: '#566B52', soft: '#E7EDE4' },
        sky: { DEFAULT: '#4A7787', soft: '#E4EDF0' },
        amber: { DEFAULT: '#B98A32', soft: '#F8F0DC' },
        clay: { DEFAULT: '#A6453C', soft: '#F7E5E2' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-jost)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        brand: '0.14em',
      },
      borderRadius: {
        brand: '0.625rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 32, 34, 0.04), 0 8px 24px -12px rgba(28, 32, 34, 0.14)',
        lift: '0 2px 4px rgba(28, 32, 34, 0.05), 0 18px 40px -18px rgba(28, 32, 34, 0.28)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
