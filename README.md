# Shirt Terrain

Core 3 · Site Project · Assignment 2, Part 1

## Files

- `shirt-terrain.html` — the main piece: the 3D cloth shirt, the cross-stitch garden, and the notebook answers. All the code (HTML, CSS, JavaScript) is in this one file.
- `stitch-text.js` — the embroidered lettering in the notebook: words are re-sewn as running stitches with a single-line font from `fonts/`. Change the font, letter size, stitch length and thread thickness at the top of this file.
- `fonts/` — single-line (one pen stroke per letter) fonts, SIL Open Font License, from the EMS/Hershey font collection.
- `buttons/` — the shirt buttons, cut from your button sheet (`fold.png`, `flat.png`, `wash.png`; `dark.png` and `xthread.png` are spares).
- `shirt/` — textures: front photo (`color.jpg`), plain back (`back-color.jpg`), cutout (`alpha.png`), fabric bumps, and `pattern-mask.png` (keeps plants off the duck and LUCKY).
- `garden-styles.html`, `map-styles.html` — the style study demos.

## Run it

The page loads textures, so it has to be served, not opened by double-clicking. In VS Code's terminal, from this folder:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/shirt-terrain.html. (The VS Code "Live Server" extension works too.)

## Good places to tweak (in `shirt-terrain.html`)

- **Answers text:** the `<dl>` sections under Observe / Interpret / Respond. Yellow `check` notes are things to fill in after the hike.
- **Thread colours of the lettering:** `--berry`, `--rose`, `--violet`, `--navy` and the `--thread` rules in the `<style>` block.
- **Buttons:** `.sew` rules in the `<style>` block (size, spin speed, hover and click animations); the ring text is the `<textPath>` inside each button.
- **Garden:** search for `the garden`. `PLANT_SCALE`, `THREAD_W`, `MAX_PLANTS`, `WEIGHTS` (how often each flower appears), the thread palettes `STEM` / `LEAF`, and each species in `SPECIES`.
- **Furrows from folds:** `sproutFurrows` (`budget` = plants per fold, `SPROUT_DELAY` = seconds to spread).
- **Wash:** `gardenStep` (`dt / 5` = 5-second fade, `globalAlpha = 0.1` = strength of the faint trace).
