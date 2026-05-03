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
        // PageCast dark cinematic palette
        bg: {
          primary: '#0D0D0F',
          secondary: '#141416',
          card: '#1A1A1E',
          elevated: '#222228',
          hover: '#2A2A32',
          border: '#2E2E38',
        },
        accent: {
          DEFAULT: '#7C5CFC',
          hover: '#9374FD',
          muted: '#3D2E7A',
          glow: 'rgba(124, 92, 252, 0.25)',
        },
        gold: {
          DEFAULT: '#F5C842',
          muted: '#7A6220',
        },
        text: {
          primary: '#F0EFF8',
          secondary: '#9896A8',
          muted: '#5C5A6A',
          accent: '#A98BFF',
        },
        success: '#3DD68C',
        warning: '#F5C842',
        danger: '#F05F6E',
        info: '#4DB8FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        accent: '0 0 20px rgba(124, 92, 252, 0.3)',
        card: '0 2px 12px rgba(0,0,0,0.4)',
        elevated: '0 8px 32px rgba(0,0,0,0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'waveform': 'waveform 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        waveform: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
