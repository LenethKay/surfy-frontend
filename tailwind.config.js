/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B2A6F',
          700: '#123A94',
        },
        blue: {
          600: '#1E5BD8',
          300: '#8FB8FF',
        },
        sky: {
          100: '#E6F0FF',
        },
        orange: {
          500: '#F08A3C',
          400: '#F7A35E',
        },
        cream: {
          50: '#FAF3E8',
        },
        peach: {
          100: '#FFE8D2',
        },
        logo: {
          red: '#D23F3C',
        },
        risk: {
          low: '#2FAE6B',
          medium: '#F2B632',
          high: '#D92D3A',
          unknown: '#8A94A6',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'sans-serif'],
        display: ['"Fraunces Variable"', 'serif'],
      },
    },
  },
  plugins: [],
};
