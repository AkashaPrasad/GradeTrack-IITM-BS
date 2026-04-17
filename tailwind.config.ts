import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        bg: 'hsl(var(--bg) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        surface2: 'hsl(var(--surface-2) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        borderstrong: 'hsl(var(--border-strong) / <alpha-value>)',
        fg: 'hsl(var(--fg) / <alpha-value>)',
        fgmuted: 'hsl(var(--fg-muted) / <alpha-value>)',
        fgsubtle: 'hsl(var(--fg-subtle) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        accentfg: 'hsl(var(--accent-fg) / <alpha-value>)',
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)'
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '10px',
        xl: '14px'
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        md: '0 4px 8px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        lg: '0 12px 24px -8px rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.06)',
        ring: '0 0 0 2px hsl(var(--ring) / 0.35)'
      },
      letterSpacing: {
        tightest: '-0.03em',
        tighter: '-0.02em'
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
