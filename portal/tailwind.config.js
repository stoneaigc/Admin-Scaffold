/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E6F1FB',
          200: '#85B7EB',
          600: '#185FA5',
          800: '#0C447C',
        },
      },
    },
  },
  plugins: [],
};
