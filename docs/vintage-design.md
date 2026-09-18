# Vintage NIS Hub interface

The supplied light/dark reference guides the compact greeting, green and copper palette, paired timetable/reading panels, and botanical sidebar. Quotes, pill controls and lifting hover effects are deliberately excluded, following the project owner's instructions.

## Shared system

- Display family: Times New Roman, Times, Liberation Serif, serif. The fallback applies on devices without Times New Roman installed.
- Body: locally served Outfit and Noto Sans variable fonts, including Cyrillic and Kazakh characters.
- Rounded rectangle controls use a 6 px corner radius.
- `src/components/academic-art.tsx` contains original SVG botanical flourishes and academic line illustrations. Decorations are hidden from assistive technology and do not intercept input.
- Colour variables and responsive layouts live in `src/app/globals.css`.
- New copy is provided in Russian, Kazakh and English in `src/lib/vintage-copy.ts`.
- The homepage shows at most three recent books; the full reading history remains in the profile.
- GSAP animations are scoped to the homepage and cleaned up on navigation. The pause control and operating-system reduced-motion preference disable motion.

## Control refinement, September 2026

- The header search uses a filled rounded rectangle and a magnifier submit button; its GET `/library?q=…` behavior is unchanged.
- Only Light and Dark remain. Legacy System, missing and invalid preferences migrate to Light. Both explicit choices persist; operating-system colour changes do not override them.
- Theme segments use two equal columns and a sliding indicator. Keyboard radio navigation, focus rings and reduced-motion support remain available.
- The sidebar toggle is icon-only with translated accessible labels and tooltips. Its rail retains icon positions; sidebar width and content margin use the same 360 ms easing. Collapsed legal links are inert and hidden.
- Reload actions share `reload-button.tsx`; rotation restarts on activation. The AI action in `ai-generate-button.tsx` uses a green dimensional surface and gold highlights, with pending feedback driven by the existing request state.
- Control styles are adapted from the supplied Uiverse examples by joe-watson-sbf, devsebastian44, JaydipPrajapati1910 and dexter-st. New control icons use Radix Icons. Corner radii remain rectangular, with no hover lifting.
- Removed an accidentally nested legacy stylesheet from the reduced-motion block so that disabling animation preserves the same layout and colours.

## Generated banner asset

Saved asset: `public/images/academic-still-life.webp` (1536 × 1024, alpha transparency).

Generated with the built-in `image_gen` tool. The original PNG is retained in the local Codex generated-images directory. WebP conversion preserves alpha and reduces transfer size; Next Image serves responsive variants.

Final generation prompt:

> Use case: product-mockup. Asset type: transparent decorative still-life asset for a vintage academic NIS school portal website banner, not a website mockup. Create an exquisite realistic studio still life: a small lush living laurel-like plant with elegant pointed deep forest green leaves, growing from a short warm ivory textured ceramic cylinder vase; next to it a horizontal stack of three antique dark forest green cloth and leather textbooks with subtle brass tooling, cream page edges and one slim copper bookmark, with a fourth thin book leaning gently behind. Refined scholarly atmosphere, realistic detailed leaves, tactile linen, aged paper and restrained gold. Soft natural light from upper left, gentle contact shadows, warm neutral exposure that works on both cream paper and dark forest green website backgrounds. Composition: low wide arrangement, plant in left third, book stack in right two thirds, all object contours fully in frame with 5% breathing room; overall landscape ratio 3:2, high resolution. Entire background genuinely transparent alpha, no wall, no room, no tabletop plane, only minimal soft contact shadow under objects. Absolutely NO text, NO letters, NO quotes, NO logos, NO watermark, NO labels on spines, NO border, NO UI. These are decorative academic books, not identifiable commercial products. Output one finished image asset.
