/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#121212',
        foreground: '#f8f8f8',
        card: '#1e1e1e',
        primary: {
          DEFAULT: '#a5b4fc', // pastel indigo
          hover: '#818cf8',
        },
        secondary: {
          DEFAULT: '#c4b5fd', // pastel violet
          hover: '#a78bfa',
        },
        accent: {
          DEFAULT: '#bae6fd', // pastel sky
          hover: '#7dd3fc',
        },
        success: {
          DEFAULT: '#a7f3d0', // pastel emerald
          hover: '#6ee7b7',
        },
        warning: {
          DEFAULT: '#fde68a', // pastel amber
          hover: '#fcd34d',
        },
        error: {
          DEFAULT: '#fca5a5', // pastel red
          hover: '#f87171',
        },
        muted: '#737373',
        border: '#313131',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
