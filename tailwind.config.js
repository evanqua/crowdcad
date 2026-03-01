/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/react");

module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── App Design Tokens ─────────────────────────────────── */

        // Surface palette — dark-mode background & text hierarchy
        surface: {
          DEFAULT:  '#dbd8e3',   // default text on dark backgrounds
          light:    '#faf9f5',   // primary / high-contrast text
          faint:    '#c2c0b6',   // muted / secondary text
          liner:    '#252528',   // borders, dividers, table headers
          deep:     '#18181b',   // card & panel backgrounds
          deeper:   '#1c1c1d',   // slightly elevated panels
          deeperer: '#151516',   // intermediate depth
          deepest:  '#0d0d0e',   // page background
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
        aurora: 'aurora 90s linear infinite',
      },
      keyframes: {
        aurora: {
          from: { backgroundPosition: '50% 50%, 50% 50%' },
          to:   { backgroundPosition: '350% 50%, 350% 50%' },
        },
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            primary: { DEFAULT: "#5eaae8", foreground: "#0d0d0e" },
          },
        },
      },
    }),
  ],
};
