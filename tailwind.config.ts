import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}','./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: { brand: { DEFAULT: '#1a4d2e', light: '#2d7a4e', muted: '#E8F5E9' } } } },
  plugins: [],
}
export default config
