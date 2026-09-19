import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef3f2', 100: '#fee4e2', 500: '#f43f5e',
          600: '#e11d48', 700: '#be123c', 900: '#881337'
        }
      },
      animation: {
        'gradient': 'gradient 8s ease infinite'
      }
    }
  },
  plugins: []
};
export default config;
