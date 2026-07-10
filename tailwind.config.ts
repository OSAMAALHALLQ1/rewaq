import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/server/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        "primary-light": {
          DEFAULT: "var(--primary-light)",
          foreground: "var(--primary-light-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        rewaq: {
          50: "#F1F6FF", 100: "#E2ECFF", 200: "#C5DAFF", 300: "#99BDFF", 400: "#6398FF",
          500: "#3E79F7", 600: "#255FDD", 700: "#1E4CB7", 800: "#1F418F", 900: "#20396F", 950: "#152448",
        },
        success: { DEFAULT: "var(--success)", 50: "#ECFDF3", 100: "#D1FAE0", 200: "#A7F3C4", 500: "#22C55E", 600: "#16A34A", 700: "#15803D" },
        warning: { DEFAULT: "var(--warning)", 50: "#FFF8EB", 100: "#FEECC8", 200: "#FCD99A", 500: "#F59E0B", 600: "#D97706", 700: "#B45309" },
        danger: { DEFAULT: "var(--danger)", 50: "#FFF1F2", 100: "#FFE4E6", 200: "#FECDD3", 500: "#F04452", 600: "#DC2638", 700: "#B91C2C" },
        info: { DEFAULT: "var(--info)", 50: "#ECFEFF", 100: "#CFFAFE", 200: "#A5F3FC", 500: "#06B6D4", 600: "#0891B2", 700: "#0E7490" },
        accounting: { DEFAULT: "var(--accounting)", 50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 500: "#8B5CF6", 600: "#7C3AED", 700: "#6D28D9" },
        marketing: { DEFAULT: "var(--marketing)", 50: "#FFF3F0", 100: "#FFE1DA", 500: "#F26B5E", 600: "#DF5145", 700: "#BD3D34" },
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
      },
      borderRadius: {
        "3xl": "1.125rem",
        "4xl": "1.375rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        soft: "var(--shadow-sm)",
        lift: "var(--shadow-lg)",
      },
      letterSpacing: {
        tight: "0",
      },
      fontFamily: {
        sans: ["var(--font-tajawal)", "Segoe UI", "Arial", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
