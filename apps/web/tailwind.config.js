/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        neutrino: {
          950: '#07090e',
          900: '#0c0f17',
          850: '#111520',
          800: '#171c2b',
          750: '#1e2437',
          700: '#272f47',
          600: '#384364',
          500: '#4e5d8a',
          400: '#7585b2',
          300: '#9eaedc',
          200: '#c5d1f4',
          100: '#e1e8fc',
          50: '#f0f4ff',
        },
        accent: {
          primary: '#6366f1',
          hover: '#4f46e5',
          light: '#818cf8',
          subtle: 'rgba(99, 102, 241, 0.12)',
        },
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
