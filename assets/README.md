# Pond Visual Asset Guide

## Best Image Formats

Use PNG or WebP.

- Background scene: PNG or WebP, 9:16 portrait.
- Fish sprites: PNG with transparent background.
- Foreground scenery overlays: PNG with transparent background.
- UI icons: SVG or PNG.

## Exact Files To Generate

Put these files in this folder:

1. pond-background.png
   - Full vertical pond scene.
   - Size: 1080 x 1920 or 1440 x 2560.
   - No fish, no text, no UI.
   - Should include water, rocks, lilies, dock, flowers, depth, cinematic lighting.

2. pond-foreground.png
   - Transparent PNG overlay.
   - Same size as background.
   - Contains only foreground items that should sit above fish: dock edge, close rocks, leaves, overhanging blossoms.
   - No water background, no fish, no text.

3. fish-kohaku.png
   - Transparent PNG fish sprite, top-down view.
   - One koi facing right.

4. fish-gold.png
   - Transparent PNG fish sprite, top-down view.
   - One golden koi facing right.

5. fish-shiro.png
   - Transparent PNG fish sprite, top-down view.
   - One black-and-white koi facing right.

6. grimm-orb.png optional
   - Transparent PNG character/orb for Grimm.
   - Small dark mischievous eye/orb.

## Gemini Prompt: Background

Create a premium vertical mobile game background, 9:16 portrait, top-down view of a cinematic Japanese koi pond. Clear turquoise deep water with realistic caustic light patterns, soft sunlight beams entering from upper left, mossy rocks framing the edges, lily pads with pink lotus flowers, a small wooden dock in the lower right, subtle cherry blossoms in the upper left, drifting petals on the water, tranquil luxury mobile app aesthetic. No fish, no people, no text, no UI, no logo. High detail, painterly realistic, soft atmospheric depth, suitable as an interactive app background.

Negative prompt: no text, no labels, no fish, no humans, no cartoon style, no flat vector art, no watermark, no logo, no extra UI elements.

## Gemini Prompt: Foreground Overlay

Create a transparent PNG foreground overlay for a vertical 9:16 mobile koi pond scene. Include only foreground elements: lower-right wooden dock edge, close mossy rocks at screen edges, a few overhanging cherry blossom branches, a few lily pads partly entering from corners. Transparent background. No water fill, no fish, no text, no UI, no logo. Painterly realistic, premium mobile game style, top-down view.

## Gemini Prompt: Fish Sprite

Create a transparent PNG sprite of a single koi fish, top-down view, facing right, centered, no shadow baked into the image, no background. Premium painterly realistic mobile game asset. The koi should have elegant fins, detailed scales, soft color gradients, and a natural body shape. Leave generous transparent padding around the fish.

Variations:
- Kohaku koi: white body with orange-red patches.
- Golden koi: warm metallic gold body.
- Shiro utsuri koi: white body with black patches.

Negative prompt: no water, no pond, no text, no multiple fish, no frame, no background, no cartoon outline.

## Recommended Generation Settings

- Aspect ratio for background/foreground: 9:16.
- Resolution: highest available, then export/download as PNG.
- Fish: square canvas if possible, transparent background, PNG.
- Keep fish facing right, because the app can rotate it in code.

## How To Use

After generating, rename files exactly as listed above and put them in this assets folder. Refresh the app. The app will automatically use pond-background.png when it exists.


## Critical Foreground Warning

The foreground PNG must contain real alpha transparency. Do not render a checkerboard background into the image. If you see gray-and-white squares when opening the PNG, that is not transparency; it is baked pixels and cannot be used as an overlay.

Add this to the Gemini foreground prompt:

Do not render a checkerboard transparency pattern. The background must be truly transparent alpha pixels, not white, gray, checkerboard, or simulated transparency. Export as an actual transparent PNG.


## Next Phase: Fish Sprites

Generate these next and place them here:

- fish-kohaku.png
- fish-gold.png
- fish-shiro.png

They must be transparent PNGs, single fish only, top-down, facing right. The app will automatically use them when present.
