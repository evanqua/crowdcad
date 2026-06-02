/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/react");

const CARD_BACKGROUND_OPACITY = {
  red: "0.20",
  blue: "0.20",
  yellow: "0.15",
};

module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./core/src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── App Design Tokens ─────────────────────────────────── */

        // Surface palette — dark-mode background & text hierarchy
        surface: {
          DEFAULT:  'hsl(var(--surface-text) / <alpha-value>)',
          light:    'hsl(var(--surface-text-strong) / <alpha-value>)',
          faint:    'hsl(var(--surface-text-muted) / <alpha-value>)',
          liner:    'hsl(var(--surface-border) / <alpha-value>)',
          deep:     'hsl(var(--surface-bg-1) / <alpha-value>)',
          deeper:   'hsl(var(--surface-bg-2) / <alpha-value>)',
          deeperer: 'hsl(var(--surface-bg-3) / <alpha-value>)',
          deepest:  'hsl(var(--surface-bg-0) / <alpha-value>)',
          base:     'hsl(var(--surface-bg-2) / <alpha-value>)',
        },

        // Accent — primary action & brand highlight colour
        accent: {
          DEFAULT:    '#3eb1fd',  // buttons, links, active markers
          foreground: '#ffffff',  // text on accent backgrounds
        },

        // Semantic status colours
        status: {
          red:    '#e56a6a',  // errors, danger, destructive actions
          green:  '#98c379',  // success, active indicators
          blue:   '#5eaae8',  // informational, selected states
          orange: '#e2c93d',  // non-lead members, equipment runs (gold/amber)
          'card-red': `rgb(229 106 106 / ${CARD_BACKGROUND_OPACITY.red})`,
          'card-blue': `rgb(94 170 232 / ${CARD_BACKGROUND_OPACITY.blue})`,
          'card-yellow': `rgb(226 201 61 / ${CARD_BACKGROUND_OPACITY.yellow})`,
        },

        /* ── Radix / shadcn-ui primitives (CSS-variable based) ── */
        // These power the few shadcn components still in use
        // (dropdown-menu, resizable, context-menu, sheet, tooltip, etc.)
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
      },

      /* ── Border Radius ───────────────────────────────────── */
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      /* ── Animations ──────────────────────────────────────── */
      animation: {
        aurora: 'aurora 92s linear infinite',
      },
      keyframes: {
        aurora: {
          from: { transform: 'translate3d(0, 0, 0) scale(1.06)' },
          to:   { transform: 'translate3d(-14%, 0, 0) scale(1.06)' },
        },
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: { DEFAULT: "#2f8fd6", foreground: "#ffffff" },
            background: "#f4f7fb",
            foreground: "#111827",
          },
        },
        dark: {
          colors: {
            primary: { DEFAULT: "#5eaae8", foreground: "#0d0d0e" },
            background: "#0d0d0e",
            foreground: "#faf9f5",
          },
        },
      },
    }),
  ],
};
