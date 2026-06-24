/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
          800: '#115e59', 900: '#134e4a',
        },
        coral: {
          50: '#fff1f0', 100: '#ffe0de', 200: '#ffc7c3', 300: '#ff9d98',
          400: '#ff6b63', 500: '#f83f35', 600: '#e5201a', 700: '#c11710',
        },
        amber: {
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
