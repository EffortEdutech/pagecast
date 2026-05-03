import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:  '#0D0D0F',
          secondary:'#141416',
          card:     '#1A1A1E',
          elevated: '#222228',
          hover:    '#2A2A32',
          border:   '#2E2E38',
        },
        accent: {
          DEFAULT: '#7C5CFC',
          hover:   '#9374FD',
          muted:   '#3D2E7A',
          glow:    'rgba(124,92,252,0.25)',
        },
        gold:  { DEFAULT: '#F5C842', muted: '#7A6220' },
        text: {
          primary:   '#F0EFF8',
          secondary: '#9896A8',
          muted:     '#5C5A6A',
          accent:    '#A98BFF',
        },
        success: '#3DD68C',
        warning: '#F5C842',
        danger:  '#F05F6E',
        info:    '#4DB8FF',
        sepia: {
          bg:   '#1C170E',
          text: '#D9C9A3',
        },
      },
      fontFamily: {
        sans:   ['Inter', 'system-ui', 'sans-serif'],
        serif:  ['Georgia', 'Cambria', 'serif'],
        dyslexia: ['OpenDyslexic', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        accent:   '0 0 20px rgba(124,92,252,0.3)',
        card:     '0 2px 12px rgba(0,0,0,0.4)',
        elevated: '0 8px 32px rgba(0,0,0,0.6)',
        glow:     '0 0 40px rgba(124,92,252,0.15)',
      },
      animation: {
        'fade-in':     'fadeIn 0.25s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-down':  'slideDown 0.3s ease-out',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'waveform':    'waveform 1.2s ease-in-out infinite',
        'highlight-in':'highlightIn 0.4s ease-out',
      },
      keyframes: {
        fadeIn:      { '0%': { opacity:'0' },                               '100%': { opacity:'1' } },
        slideUp:     { '0%': { opacity:'0', transform:'translateY(12px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        slideDown:   { '0%': { opacity:'0', transform:'translateY(-8px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        waveform:    { '0%,100%': { transform:'scaleY(0.3)' },              '50%':  { transform:'scaleY(1)' } },
        highlightIn: { '0%': { backgroundColor:'rgba(124,92,252,0.25)' },  '100%': { backgroundColor:'rgba(124,92,252,0.08)' } },
      },
    },
  },
  plugins: [],
}
export default config
