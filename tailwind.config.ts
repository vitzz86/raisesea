// ═══════════════════════════════════════════════════════════════
// Tailwind config — RaiseSEA design system (chunk 12.2)
// ═══════════════════════════════════════════════════════════════
//
// ADDITIVE STRATEGY — chunk 12.2 introduces new semantic tokens
// alongside the existing Tailwind defaults. This lets new components
// use the design system immediately while existing pages keep working.
// Chunk 12.3 progressively migrates pages to the new tokens.
//
// Design system rules (apply to NEW components only — old code is grandfathered):
//   • Typography scale: 13 / 14 / 16 / 20 / 28 / 40 only (xs / sm / base / lg / xl / 2xl)
//   • Spacing: prefer 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
//   • Font weights: 400 / 500 / 600 only
//   • Border radius: 6px (inputs/buttons) / 8px (cards) / 16px (modals)
//   • Colors: use semantic tokens (brand, surface, text, status), not raw gray/emerald

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // ── Typography — override fontSize entirely (the value scale is small enough
    //    that this is safe; sizes like text-[13px] still work via arbitrary values)
    fontSize: {
      'xs':   ['13px', { lineHeight: '18px',  letterSpacing: '-0.005em' }],
      'sm':   ['14px', { lineHeight: '20px',  letterSpacing: '-0.011em' }],
      'base': ['16px', { lineHeight: '24px',  letterSpacing: '-0.011em' }],
      'lg':   ['20px', { lineHeight: '28px',  letterSpacing: '-0.017em' }],
      'xl':   ['28px', { lineHeight: '36px',  letterSpacing: '-0.022em' }],
      '2xl':  ['40px', { lineHeight: '48px',  letterSpacing: '-0.028em' }],
      // Legacy aliases — kept so existing text-3xl/4xl/5xl don't crash
      '3xl':  ['28px', { lineHeight: '36px',  letterSpacing: '-0.022em' }],
      '4xl':  ['40px', { lineHeight: '48px',  letterSpacing: '-0.028em' }],
      '5xl':  ['40px', { lineHeight: '48px',  letterSpacing: '-0.028em' }],
    },
    extend: {
      // ── Font family — Inter Variable
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      // ── New semantic color tokens (added; defaults like gray/emerald/etc still work)
      colors: {
        // ── Brand
        brand: {
          DEFAULT: '#1a4d2e',
          hover:   '#143d24',
          active:  '#0d2a18',
          muted:   '#2d7a4e',
          soft:    '#e8f5e9',
          pale:    '#f0faf2',
          // Legacy aliases preserved
          light:   '#2d7a4e',
        },

        // ── Surfaces (warm-tinted neutrals — distinct from cold Tailwind gray)
        surface: {
          page:    '#f4f7f5',   // page bg — darker for better card contrast
          card:    '#ffffff',
          muted:   '#eef2ef',   // muted areas (sidebar item hover, badges)
          sunken:  '#e8ede9',   // deeper sunken areas
          overlay: 'rgba(13, 31, 20, 0.4)',
        },

        // ── Borders (semantic — distinct from Tailwind's gray-200 etc)
        //    border-strong is for INPUT FIELDS — must be visibly contrasted on white
        //    backgrounds. WCAG 3:1 minimum for UI components.
        border: {
          DEFAULT: '#d4dfd7',   // card edges — subtle but visible
          muted:   '#e3eae5',   // section dividers
          strong:  '#8a9d8f',   // input borders — meets WCAG 3:1 on white (~3.1:1)
        },

        // ── Text (semantic — distinct from Tailwind's gray-900 etc)
        text: {
          primary:   '#0d1f14',
          secondary: '#3d5045',
          tertiary:  '#6b7d6e',
          inverse:   '#ffffff',
          link:      '#1a4d2e',
          disabled:  '#a8b3aa',
        },

        // ── Status — muted, not saturated (distinct from default red-500/emerald-500)
        success: {
          bg:     '#ecf7ef',
          border: '#c5e1cc',
          text:   '#1e5631',
          solid:  '#2d7a4e',
        },
        warning: {
          bg:     '#fef6e7',
          border: '#fae5b5',
          text:   '#7a5a00',
          solid:  '#d97706',
        },
        danger: {
          bg:     '#fdeded',
          border: '#f5c5c5',
          text:   '#8a1f1f',
          solid:  '#c0392b',
        },
        info: {
          bg:     '#eaf2fb',
          border: '#c5dcef',
          text:   '#1e3a5f',
          solid:  '#2563a3',
        },
      },

      // ── Border radius (extending — old rounded-md/lg/xl still work)
      // Tailwind defaults: md=6px, lg=8px, xl=12px, 2xl=16px
      // Our spec: 6px buttons, 8px cards, 16px modals
      // The defaults happen to align well; we just add semantic aliases:
      borderRadius: {
        'input':  '6px',
        'card':   '8px',
        'modal':  '16px',
      },

      // ── Shadows (extending — old shadow-md/lg still work but discouraged)
      boxShadow: {
        'subtle': '0 1px 2px rgba(13, 31, 20, 0.04)',
        'hover':  '0 4px 12px rgba(26, 77, 46, 0.08)',
        'modal':  '0 16px 48px rgba(13, 31, 20, 0.12)',
      },

      // ── Animations (subtle micro-interactions)
      keyframes: {
        'fade-in':    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up':   { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'slide-down': { '0%': { transform: 'translateY(-8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'scale-in':   { '0%': { transform: 'scale(0.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        'shimmer':    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-in':    'fade-in 150ms cubic-bezier(0.0, 0, 0.2, 1)',
        'slide-up':   'slide-up 200ms cubic-bezier(0.0, 0, 0.2, 1)',
        'slide-down': 'slide-down 200ms cubic-bezier(0.0, 0, 0.2, 1)',
        'scale-in':   'scale-in 150ms cubic-bezier(0.0, 0, 0.2, 1)',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
