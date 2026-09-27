// ═══════════════════════════════════════════════════════════════
// components/brand/RaiseSEALogo.tsx
//
// Renders RaiseSEA's approved brand lockup, unaltered.
//
// Source of truth: /opt/data/raisesea-social/assets/brand/manifest.json
//   primary — logo-primary.png, 800x175, "Original full lockup; preserve
//             its existing background and proportions".
//   footer  — logo-footer.png, 320x53, transparent, "Existing footer
//             asset; use on dark green bands and verify contrast".
//   light   — null
//   mark    — null
//   "Do not generate, recolor or crop replacement logos. Use the
//    supplied lockup on a compatible band or request the approved
//    variant."
//
// Consequently this file does NOT draw anything. An earlier revision of
// the landing page shipped a hand-drawn SVG mark with a rising arrow and
// a gold wave; that was not the brand's logo and has been removed.
//
// Why the two variants are used where they are:
//   primary carries its own OPAQUE ground, rgb(15,46,27) — verified by
//   sampling its corner pixels. It is therefore only correct on a dark
//   band, or presented as a plate in its own right.
//   footer is white-on-transparent — verified 66% fully transparent — so
//   it reads on our dark green bands and is invisible on light ones.
// There is no approved light-background variant, so nothing here is
// recoloured to invent one.
// ═══════════════════════════════════════════════════════════════

const VARIANTS = {
  // Full lockup with its own opaque dark-green ground.
  primary: { src: '/brand/raisesea-logo-primary.png', w: 800, h: 175 },
  // Transparent, white wordmark — for dark green bands.
  onDark: { src: '/brand/raisesea-logo-footer.png', w: 320, h: 53 },
} as const

export type LogoVariant = keyof typeof VARIANTS

export function RaiseSEALogo({
  variant = 'primary',
  height = 34,
  className,
  alt = 'RaiseSEA',
}: {
  variant?: LogoVariant
  height?: number
  className?: string
  alt?: string
}) {
  const asset = VARIANTS[variant]
  // Width is derived from the asset's own aspect ratio so the lockup is
  // never stretched. Both dimensions are set to reserve layout space and
  // avoid any shift on load.
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

  if (variant !== 'primary') return image

  // `primary` carries its own OPAQUE ground — rgb(15,46,27), verified by
  // sampling the asset's corner pixels. Dropped straight onto a light
  // surface its hard rectangular edge reads as a pasted-on block, and it
  // competes with the dark "Get started" button sitting right beside it.
  //
  // The fix is NOT to recolour or crop the logo — the manifest forbids
  // that, and there is no approved light variant. Instead the lockup is
  // given a compatible band: a container filled with the asset's own
  // ground colour, rounded to match the design system's input radius, with
  // just enough padding that the image never reaches the rounded corner.
  // The asset itself is untouched pixel for pixel; only its edge changes,
  // from a hard rectangle to a deliberate brand badge.
  return (
    <span className="inline-flex items-center overflow-hidden rounded-input bg-[#0f2e1b] p-[3px]">
      {image}
    </span>
  )
}
