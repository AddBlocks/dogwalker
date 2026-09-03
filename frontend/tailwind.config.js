/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bosque: { DEFAULT: "#1B4332", claro: "#2D6A4F", hoja: "#40916C" },
        greda: "#C45C26",
        crema: "#F6F1E7",
        arena: "#E8DCC8",
        tinta: "#1C1917",
        oro: "#E9B44C",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      boxShadow: {
        ficha: "0 10px 30px -12px rgba(27, 67, 50, 0.35)",
      },
    },
  },
  plugins: [],
};
