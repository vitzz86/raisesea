import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title: 'RaiseSEA — SEA Founder-Investor Intelligence',
  description: 'AI-powered fundraising intelligence for Southeast Asian startups',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
