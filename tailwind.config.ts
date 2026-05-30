import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0d1117',
          card: '#161b22',
          hover: '#1c2128',
        },
        border: '#30363d',
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
        },
        accent: '#f0b429',
        success: '#3fb950',
        danger: '#f85149',
        link: '#58a6ff',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;