/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1976D2',
          dark: '#1565C0',
          light: '#E3F2FD',
          50: '#F0F7FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          600: '#1976D2',
          700: '#1565C0',
        },
        orange: {
          DEFAULT: '#FF6B35',
          light: '#FFF0EB',
        },
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
