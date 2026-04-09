import { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0E1A',
        primary: '#00D4AA',
        danger: '#FF3B3B',
        warning: '#FFB020',
        success: '#00D4AA',
        secondary: '#94A3B8',
        card: 'rgba(255, 255, 255, 0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 212, 170, 0.3)',
        'glow-danger': '0 0 20px rgba(255, 59, 59, 0.3)',
        'glow-warning': '0 0 20px rgba(255, 176, 32, 0.3)',
      }
    },
  },
  plugins: [],
} satisfies Config
