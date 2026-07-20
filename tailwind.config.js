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
          bg: "#0B0F19",
          card: "#161C2C",
          primary: "#3B82F6",
          red: "#EF4444",
          accent: "#F59E0B"
        }
      }
    },
  },
  plugins: [],
}
