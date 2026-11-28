/** @type {import('tailwindcss').Config} */

// Andes admin palette (from the approved Analytics prototype). "blue" and
// "indigo" are the primary action colour and are mapped to the Andes green so
// every existing bg-blue-*/text-blue-* follows the brand; "slate" and "gray"
// are the warm green-grey neutrals. Status colours (red, amber, emerald, rose)
// are left as Tailwind's defaults.
const andesGreen = {
  50: '#eef5f0',
  100: '#d9f1e3',
  200: '#b7e0c8',
  300: '#8cc9a9',
  400: '#5aa586',
  500: '#2f8267',
  600: '#16654e',
  700: '#0f4f3c',
  800: '#0b3d2f',
  900: '#112d25',
  950: '#0b2019',
};
const andesNeutral = {
  50: '#f3f6f2',
  100: '#eaf0eb',
  200: '#dfe8e2',
  300: '#c7d5cd',
  400: '#8aa39b',
  500: '#6b827b',
  600: '#58706a',
  700: '#3d5450',
  800: '#26403a',
  900: '#172c28',
  950: '#0f1f1c',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: andesGreen,
        indigo: andesGreen,
        slate: andesNeutral,
        gray: andesNeutral,
        brand: {
          DEFAULT: '#16654e',
          dark: '#0f4f3c',
          light: '#d9f1e3',
          50: '#eef5f0',
          100: '#d9f1e3',
          200: '#b7e0c8',
          600: '#16654e',
          700: '#0f4f3c',
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
