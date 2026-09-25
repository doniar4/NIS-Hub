# Hello screen integration

The logged-out `/` page displays the reference-led Hello composition. Launch NIS Hub is removed. Scrolling reveals the existing registration/sign-in forms in place of the Osmo icon in the supplied demo. The device artwork is also an accessible link to the forms. Authenticated visitors continue to see the dashboard; signing out returns to `/`.

## Structure

- `src/components/ui/parallax-scrolling.tsx`: client-only GSAP / ScrollTrigger / Lenis wrapper with server-rendered header, visual and form slots.
- `src/components/welcome-screen.tsx`: server composition and configured-auth state.
- `src/components/welcome-devices.tsx`: three CSS viewports of the same local product photograph, with independently animated screen layers.
- `src/components/welcome-auth.tsx`: local signup/login tab state, arrow-key navigation and existing server-action forms. No additional context provider is needed.
- `src/styles/welcome.css`: responsive layout, light/dark tokens, motion and reduced-motion fallbacks. Imported by `src/app/globals.css` after the existing public styles.
- `src/demos/default.tsx`: standalone server-rendered demo, with authentication disabled.

The project already has TypeScript, Tailwind CSS 4 and `@tailwindcss/postcss`. Components normally live in `src/components`. `@/*` resolves to `src/*`, so `src/components/ui` is the appropriate equivalent of the requested `/components/ui` directory. Keeping reusable components there makes copied shadcn-compatible imports resolve consistently without moving existing `src/components/ui.tsx` exports.

`components.json` records the RSC/TypeScript setup and aliases. `src/lib/utils.ts` supplies the conventional `cn()` helper. The existing theme remains authoritative. A fresh project could use `npx shadcn@latest init`; reinitializing this project is unnecessary. See [shadcn configuration](https://ui.shadcn.com/docs/components-json).

Dependencies installed: `npm install @studio-freight/lenis lucide-react clsx tailwind-merge`. GSAP was already installed. `@studio-freight/lenis` 1.0.42 is the exact package requested by the supplied example; npm marks it deprecated in favor of `lenis`. It is scoped to the welcome page. A future migration can replace its import after testing scroll behavior.

## Motion and accessibility

The supplied four-layer parallax model retains the 70 / 55 / 40 / 10 relative scroll rates. It transitions into a working auth panel instead of the sample logo. Browser scrolling, touch and keyboard navigation remain available. No forced redirect, timed modal or pinned form is used.

All animation contexts, event listeners and the Lenis ticker callback are removed on unmount. Other pages' ScrollTriggers are never killed. System reduced motion disables parallax and looping screen animations; the visible pause control provides another way to stop them. The form remains server-rendered and usable without animation. A visible keyboard focus indicator is preserved.

The reference overrides the skills' random layout selection, extra AIDA/bento sections, stock landscape photos, and duplicate hero CTA patterns. Apple Design informed keyboard access, contrast, touch targets and reduced-motion behavior; gpt-taste informed the layered motion; design-taste-frontend informed responsive composition and isolated client animation.

Colors reuse the existing cool blue and green brand. Light hero text `#080f24` on `#fafbff`: 18.39:1; secondary `#68748b`: 4.55:1. Dark hero text `#f0f5fc` on `#091321`: 17.02:1; secondary `#a7b5cb`: 8.98:1. White submit text on `#2e6bea`: 4.76:1. Display Outfit, body Noto Sans; no new web font downloads.

## Generated asset

Built-in image generation produced `public/images/welcome-devices.webp` (1536 x 1024, transparent WebP, approximately 60 KB). The PNG source remains in the generator output directory. A single local request supplies all three hardware viewports. Stock photos are unnecessary because the reference explicitly calls for device artwork; the landscape images in the generic component are replaced by the requested scene.

Final generation prompt:

> Use case: product-mockup. Generate an ultra high quality photorealistic device product photograph asset for a website. Wide landscape 3:2 canvas. GENUINELY TRANSPARENT BACKGROUND, clean alpha, no floor or backdrop. Exactly three silver/dark graphite devices standing together on the same ground baseline: portrait tablet on left, big open laptop centered, portrait smartphone on right, matching the layout of premium Apple product launch pages. Laptop width about 56% of group, tablet 22%, phone 15%; each device distinct, small gaps, NO overlapping devices. Tight crop around the entire group with 3% transparent margin. Front view from very slightly above eye-level, nearly frontal flat upright screens, laptop has a beautiful realistic silver keyboard and trackpad deck visible in perspective in foreground, thin black bezel, tiny central top camera notch. Tablet thin metallic frame with round corners; phone black frame with dynamic island. All THREE SCREENS are perfectly blank uniform PALE WHITE (#fafbff), absolutely NO text, no logos, no icons, no gradients inside screens (we will composite live web animation into screen regions). Realistic metal edge highlights, detailed laptop keyboard, subtle glass specular edges. Camera 85mm lens, bright soft studio lighting, silver and graphite palette. All devices entirely in frame. No extra objects, no text, no watermark. Transparent background essential. This is only a product asset, NOT an entire webpage.
