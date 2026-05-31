import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RaiseSEA — SEA Founder-Investor Intelligence',
  description: 'AI-powered fundraising intelligence for Southeast Asian startups',
}

// CRITICAL: viewport meta tells mobile browsers to render at the actual device
// width instead of the default virtual 980px width. Without this, mobile Safari
// and Chrome render the page as if it were 980px wide and then visually scale it
// down to fit the screen — which makes everything look microscopically small and
// breaks CSS media queries.
//
// With this:
//   - Mobile viewport reports the real device width (e.g., 375px on iPhone SE)
//   - Tailwind's sm:/md:/lg: breakpoints fire correctly
//   - Text renders at its intended size
//   - Layouts use the responsive variants we wrote
//
// maximumScale: 5 allows zoom for accessibility (low-vision users may need to
// zoom in to read small text) while preventing extreme zoom that breaks layouts.
export const viewport: Viewport = {
  width:          'device-width',
  initialScale:   1,
  maximumScale:   5,
  userScalable:   true,
  themeColor:     '#1a4d2e',  // brand color for mobile browser chrome
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
