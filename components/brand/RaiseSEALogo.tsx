// ═══════════════════════════════════════════════════════════════
// components/brand/RaiseSEALogo.tsx
//
// Renders RaiseSEA's approved brand lockup, unaltered.
//
// Source of truth: /opt/data/raisesea-social/assets/brand/manifest.json
//   "Do not generate, recolor or crop replacement logos. Use the
//    supplied lockup on a compatible band or request the approved
//    variant."
// Nothing in this file draws, recolours or crops anything.
//
// Measured facts about the two approved assets — sampled from the pixels,
// not assumed. These drive which one is used where:
//
//   logo-primary.png  800x175, OPAQUE ground rgb(15,46,27).
//                     Logo content is only 710x77 — 44% of the file
//                     height. Rendered at 32px that puts an ~8px logo
//                     inside a 32px dark block: illegible, and it reads
//                     as a misplaced sticker. Viable only at roughly 45px
//                     and above, and only on a matching dark band.
//
//   logo-footer.png   320x53, TRANSPARENT, white wordmark. Logo content
//                     is 306x43 — 81% of the file height — so it stays
//                     legible at navigation sizes. The manifest's stated
//                     use for it is "on dark green bands".
//
// Hence the transparent variant is the one used on this site: it is the
// only approved asset that survives being rendered small on a dark band.
// The opaque plate is kept available as `full` for large contexts rather
// than deleted.
//
// There is no approved light-background variant (manifest light: null), so
// the light navigation gives the lockup a compatible dark band instead of
// inverting or recolouring it.
//
// An earlier revision of the landing page shipped a hand-drawn SVG mark
// (a rising arrow with a gold wave) taken from an unused repo file. That
// was not the brand's logo and has been removed.
// ═══════════════════════════════════════════════════════════════

const VARIANTS = {
  // Transparent, white wordmark. Content fills 81% of the file height.
  // For use on dark green.
  onDark: { src: '/brand/raisesea-logo-footer.png', w: 320, h: 53 },
  // Opaque plate with generous internal padding — content fills only 44%
  // of the file height. Legible at ~45px and above; not for navigation.
  full: { src: '/brand/raisesea-logo-primary.png', w: 800, h: 175 },
} as const

export type LogoVariant = keyof typeof VARIANTS

export function RaiseSEALogo({
  variant = 'onDark',
  height = 26,
  band = false,
  className,
  alt = 'RaiseSEA',
}: {
  variant?: LogoVariant
  height?: number
  /** Wrap in a rounded dark-green band — the "compatible band" the
   *  manifest requires before the lockup sits on a light surface. */
  band?: boolean
  className?: string
  alt?: string
}) {
  const asset = VARIANTS[variant]
  // Width derived from the asset's own aspect ratio, so the lockup is never
  // stretched. Both dimensions are set to reserve layout space and avoid
  // any shift on load.
  const width = Math.round((asset.w / asset.h) * height)

  const image = (
    <img
      src={asset.src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      decoding="async"
    />
  )

  if (!band) return image

  // The band is ours; the lockup inside it is untouched pixel for pixel.
  // NOTE: the band colour must stay a literal class here. Tailwind scans
  // source text, so an interpolated `bg-[${BAND}]` would compile to
  // nothing at all and the band would silently be transparent.
  return (
    <span className="inline-flex items-center overflow-hidden rounded-input bg-[#0f2e1b] px-3 py-2">
      {image}
    </span>
  )
}
