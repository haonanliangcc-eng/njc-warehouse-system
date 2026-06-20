import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        line: "#d7dde8",
        paper: "#f6f8fb",
        brand: "#186f8f",
        accent: "#d66a2a",
        good: "#2f7d57",
        warn: "#b7791f",
        danger: "#b42318"
      },
      boxShadow: {
        panel: "0 10px 30px rgba(23, 32, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
