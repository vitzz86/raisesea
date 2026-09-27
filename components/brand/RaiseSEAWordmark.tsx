// ═══════════════════════════════════════════════════════════════
// components/brand/RaiseSEAWordmark.tsx
//
// The canonical brand mark. Geometry and colours are taken verbatim
// from public/brand/raisesea-wordmark.svg — that file shipped with the
// repo but was referenced nowhere, so every surface rendered the name
// as loose text while the real asset sat unused.
//
// The mark is drawn inline rather than loaded through <img src="*.svg">
// for two reasons:
//   1. An SVG loaded in an <img> is rendered in an isolated context, so
//      it cannot load a webfont. The original file sets its text in
//      Inter, which would silently fall back to whatever the visitor's
//      machine happens to have.
//   2. Inline SVG can recolour per surface (the tile is nearly the same
//      value as our dark gradient bands and would disappear if reused
//      unchanged there).
// The wordmark itself is real HTML text, so it stays selectable, using
// our own loaded font, and reads correctly to assistive tech.
// ═══════════════════════════════════════════════════════════════

export type BrandTone = 'brand' | 'onDark'

const TILE: Record<BrandTone, string> = {
  // #1A4D2E — the asset's own tile colour.
  brand: '#1a4d2e',
  // Brand-muted. The asset's tile is within a few percent of our dark
  // gradient bands (#0d2a18), so on those surfaces it needs lifting.
  onDark: '#2d7a4e',
}

export function RaiseSEAMark({
  size = 32,
  tone = 'brand',
  className,
}: {
  size?: number
  tone?: BrandTone
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Tile */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill={TILE[tone]} />
      {/* Rising line — the "raise" */}
      <path
        d="M17 39.5C25.5 27 34.5 22 47 20.5"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Gold wave beneath it */}
      <path
        d="M17 45C27 42.5 36.5 42.5 48 47"
        stroke="#d8a640"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Arrowhead closing the rising line */}
      <path
        d="M45.5 20.5L47.5 30.5L38 27.5"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RaiseSEAWordmark({
  tone = 'brand',
  markSize = 30,
  withTagline = false,
  textClassName,
}: {
  tone?: BrandTone
  markSize?: number
  withTagline?: boolean
  textClassName?: string
}) {
  const nameColour = tone === 'onDark' ? 'text-text-inverse' : 'text-brand'
  const tagColour = tone === 'onDark' ? 'text-white/60' : 'text-text-tertiary'

  return (
    <span className="inline-flex items-center gap-2.5">
      <RaiseSEAMark size={markSize} tone={tone} />
      <span className="flex flex-col justify-center">
        <span
          className={`font-bold leading-none tracking-tight ${nameColour} ${textClassName ?? 'text-[17px]'}`}
        >
          RaiseSEA
        </span>
        {withTagline && (
          // "FOUNDER INTELLIGENCE" is the tagline baked into the original
          // asset, kept verbatim rather than invented here.
          <span
            className={`mt-1 font-semibold uppercase leading-none ${tagColour} text-[9px] tracking-[0.14em]`}
          >
            Founder intelligence
          </span>
        )}
      </span>
    </span>
  )
}
