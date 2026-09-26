/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul bebê #89CFF0 = brand-300 (cor da marca)
        brand: {
          50: '#F2FAFE',
          100: '#E3F4FC',
          200: '#C6E9F9',
          300: '#89CFF0',
          400: '#5CB9E6',
          500: '#2F9FD6',
          600: '#1D80B4',
          700: '#17668F',
          800: '#134F6F',
          900: '#0C2D48',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
