# Skeleton loading

The existing Next.js `loading.tsx` boundaries use the named loaders in
`src/components/loaders/contextual-loaders.tsx`. They now render neutral panels
instead of the shared spinner. `SiteShell` retains the real navigation and sidebar.

Reusable primitives live in `src/components/loaders/skeleton.tsx`: `Skeleton`,
`SkeletonRegion`, `SkeletonPanel`, `SkeletonRows`, and `MaterialCardSkeleton`.
The region supplies one localized accessible status; decorative blocks are hidden
from assistive technology. Animation changes opacity only and respects reduced motion.

```tsx
import { LibrarySkeletonLoader } from "@/components/loaders/contextual-loaders";

return isLoading ? <LibrarySkeletonLoader count={6} /> : <LibraryBrowser {...props} />;
```

Asset review: `public/images/` contains welcome artwork; `promo/assets/` contains
screen captures, a contact sheet and video frames. No standalone Figma files were
found. Current JSX and CSS are the geometry reference because the promotional
captures show older layouts and an empty library.

Geometry reused: library grid uses 1/2/3 columns and a 1rem gap, with existing
responsive card padding; dashboard columns use 1.2fr/1fr and 1.25rem gaps;
profile uses 1.5fr/1fr; messages use minmax(240px,.8fr)/1.7fr. Existing radius
tokens and responsive rules are retained. Small badges and actions are represented
by grouped bars rather than individual placeholders.

These are structural placeholders, not a measured zero-CLS guarantee. Unknown
result counts, wrapped titles, metadata and PDF page dimensions affect final height.
For zero shift during a refresh, retain the already rendered container dimensions
and match the skeleton count to the known content; initial route loading cannot
know those values. Reader page placeholder assumes portrait A4.
