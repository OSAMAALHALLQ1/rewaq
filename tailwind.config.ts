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
          50: "#F0F5FF", 100: "#DEE9FF", 200: "#C2D6FF", 300: "#94B8FF", 400: "#6093FF",
          500: "#3B75FF", 600: "#1E5EFF", 700: "#1445D1", 800: "#1237A8", 900: "#11235A", 950: "#0A1128",
        },
        success: { DEFAULT: "var(--success)", 50: "#ECFDF5", 100: "#D1FAE5", 200: "#A7F3D0", 500: "#10B981", 600: "#059669", 700: "#047857" },
        warning: { DEFAULT: "var(--warning)", 50: "#FFFBEB", 100: "#FEF3C7", 200: "#FDE68A", 500: "#F59E0B", 600: "#D97706", 700: "#B45309" },
        danger: { DEFAULT: "var(--danger)", 50: "#FFF1F2", 100: "#FFE4E6", 200: "#FECDD3", 500: "#F43F5E", 600: "#E11D48", 700: "#BE123C" },
        info: { DEFAULT: "var(--info)", 50: "#ECFEFF", 100: "#CFFAFE", 200: "#A5F3FC", 500: "#06B6D4", 600: "#0891B2", 700: "#0E7490" },
        accounting: { DEFAULT: "var(--accounting)", 50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 500: "#8B5CF6", 600: "#7C3AED", 700: "#6D28D9" },
        marketing: { DEFAULT: "var(--marketing)", 50: "#FFF0F0", 100: "#FFE1E1", 500: "#FF5A5F", 600: "#E04A50", 700: "#C23B40" },
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
        glow: "var(--shadow-glow)",
        "glow-hover": "var(--shadow-glow-hover)",
        elevated: "var(--shadow-elevated)",
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
