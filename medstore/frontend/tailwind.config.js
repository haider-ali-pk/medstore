/** Brand colors come from CSS variables injected per brand in app/layout.jsx */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: "rgb(var(--brand) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        ink: "#0f172a",
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(15 23 42 / .04), 0 8px 24px -12px rgb(15 23 42 / .12)",
        lift: "0 2px 4px rgb(15 23 42 / .05), 0 18px 40px -16px rgb(15 23 42 / .25)",
      },
    },
  },
  plugins: [],
};
