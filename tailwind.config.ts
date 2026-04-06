import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        luxe: {
          bg: "#FAF7F4",
          card: "#FFFFFF",
          primary: "#1A1A2E",
          accent: "#C8A96E",
          "accent-dark": "#A68B4B",
          rose: "#B5505A",
          blush: "#E8C4C4",
          cream: "#F5F0E8",
          charcoal: "#2D2D3A",
          muted: "#8B8B9E",
          border: "#E8E4DF",
          success: "#3D9970",
          warning: "#F5A623",
          danger: "#D94F4F",
        },
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        body: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
