/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        gold: '#FFD700',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
