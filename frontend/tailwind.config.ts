import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        card: "var(--card)",
        primary: {
          DEFAULT: "#3B82F6", // Blue Accent
          hover: "#2563EB",
        },
        secondary: {
          DEFAULT: "#10B981", // Success Green
          hover: "#059669",
        },
        warning: {
          DEFAULT: "#F59E0B", // Warning Amber
          hover: "#D97706",
        },
        accent: {
          cyan: "#06b6d4",
          purple: "#a855f7",
          pink: "#ec4899",
          blue: "#3B82F6",
        },
        dark: {
          50: "#f8fafc",
          100: "#f1f5f9",
          900: "#111827",      // Dark cards
          950: "#0A0A0A",      // Dark background
        }
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 15px rgba(99, 102, 241, 0.4)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      }
    },
  },
  plugins: [],
};
export default config;
