// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        'xs': '375px',
        'sm': '480px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      colors: {
        light: "#ffffff",
        lighter: "#f3f4f6",
        "text-primary": "#1a1a1a",
        "text-secondary": "#4b5563",
        "text-light": "#6b7280",
        "border-light": "#e5e7eb",
        primary: "#1a1a2e",
        secondary: "#e67e22",
        accent: "#f39c12",
        success: "#27ae60",
        danger: "#e74c3c",
        warning: "#f1c40f",
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      minHeight: {
        'touch': '48px',
      },
      minWidth: {
        'touch': '48px',
      },
    },
  },
  plugins: [],
};
