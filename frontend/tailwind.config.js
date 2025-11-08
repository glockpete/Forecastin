/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Use class-based dark mode
  theme: {
    extend: {
      colors: {
        // Dark theme palette
        background: {
          DEFAULT: '#0f172a', // slate-900
          dark: '#020617', // slate-950
          light: '#1e293b', // slate-800
        },
        surface: {
          DEFAULT: '#1e293b', // slate-800
          dark: '#0f172a', // slate-900
          light: '#334155', // slate-700
        },
        primary: {
          DEFAULT: '#3b82f6', // blue-500
          dark: '#2563eb', // blue-600
          light: '#60a5fa', // blue-400
        },
        secondary: {
          DEFAULT: '#6b7280', // gray-500
          dark: '#4b5563', // gray-600
          light: '#9ca3af', // gray-400
        },
        accent: {
          DEFAULT: '#8b5cf6', // violet-500
          dark: '#7c3aed', // violet-600
          light: '#a78bfa', // violet-400
        },
        text: {
          DEFAULT: '#f1f5f9', // slate-100
          muted: '#cbd5e1', // slate-300
          subtle: '#94a3b8', // slate-400
        },
      },
      // Custom box shadows for dark theme
      boxShadow: {
        'dark-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
        'dark-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'dark-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
      },
      // Custom border colors for dark theme
      borderColor: {
        'dark-default': '#334155', // slate-700
        'dark-light': '#475569', // slate-600
        'dark-muted': '#64748b', // slate-500
      },
    },
  },
  plugins: [],
}
