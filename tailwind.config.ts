import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ghana: {
          red: "#ce1126",
          yellow: "#fcd116",
          green: "#006b3f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
