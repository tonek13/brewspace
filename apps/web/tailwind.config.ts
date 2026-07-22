import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B1712",
        paper: "#FBF7F0",
        surface: "#FFFFFF",
        crema: "#C8874B",
        "crema-deep": "#A66B34",
        sage: "#5F7F5C",
        clay: "#B5533C",
        steam: "#7C8A94",
        line: "#E6DED2",
      },
      fontFamily: {
        display: ['"Iowan Old Style"', "Palatino", "Georgia", "serif"],
        sans: ['system-ui', '"Segoe UI"', "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ['"SF Mono"', "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(27,23,18,0.04), 0 8px 24px rgba(27,23,18,0.06)",
        lift: "0 2px 4px rgba(27,23,18,0.06), 0 16px 40px rgba(27,23,18,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
