import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10233f",
        line: "#d9e6f7",
        paper: "#f5f9ff",
        brand: "#2563eb",
        accent: "#0ea5e9",
        good: "#0f9f6e",
        warn: "#d97706",
        danger: "#dc2626"
      },
      boxShadow: {
        panel: "0 16px 42px rgba(37, 99, 235, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
