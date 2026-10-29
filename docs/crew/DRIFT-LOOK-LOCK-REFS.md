# Drift look lock: cloud references, the picker, and the cloud pass (addendum to S0)

**Status:** Diego's answers are all folded in (section 6), including the white-peak pick. Design only, no code, no version numbers. Lives on branch `drift-2` as `docs/crew/DRIFT-LOOK-LOCK-REFS.md`. Not merged.

**Source of the sheet:** a Grok Imagine sheet, 12 images, prompt "deep blue sky, bright fluffy white clouds", 16:9, Quality 2.0. I only have the screenshot of the contact sheet, so every trait below is read by eye and is an estimate. Exact numbers come from the kept images (section 3).

---

## 0. The goal: "in the clouds"

The target is flying **among** the clouds: towers beside you at eye level, cloud tops below, undersides above, blue gaps between, and now and then a slow pass through a cloud.

**Why 1.12.4 misses it (verified in source):**
- The craft starts at height 148 and the Start label says "Among the clouds" (anything above 90 and up to 240 gets that name).
- 1.12.4 puts its clouds at about 186 to 300. Only one of the seven placed "ahead" puffs (height 156) is near eye level. You fly **beneath** a ceiling and look up, which is what the Grok sheet shows.
- The Sep 18 build (`3e48cfe`) put puffs at about 64 to 160, the first ten right in front of the craft at 88 to 130, plus a cloud-sea plane below. That is why it felt "in" the clouds.

**Design rule for 2.0:** cloud volume surrounds the craft at home height.
- **Below:** a cloud-top layer, from the sea plane or a baked texture.
- **At eye level:** about 40% of the visible puffs sit within 40 units above or below home height, so there are towers to weave between.
- **Above:** a thinner set of undersides and wisps.
- The Start label and the real scene must agree. A test places the craft at home height and counts puffs in each band (below, eye level, above).

**Cost warning (hypothesis):** eye-level clouds put big see-through puffs close to the camera, so many layers overlap on screen. That is the likeliest cause of the fps drops on 1.11.x. S5 adds a cap on overlapping layers per pixel (about 4 on `light`) and fades puffs out near the camera. Profile to confirm.

**Chase tie-in:** the Ring run threads hoops through gaps between towers. A hoop inside a cloud is optional and never required.

### 0.1 Flying through a cloud (Diego's rule, light-sensitive safe)

**What it should feel like (Diego):** the cloud gets more densely white, then a vague grey, then you come out. Diego is light-sensitive, so the rule is: **ramp in slowly, keep the white well below full brightness, never flash.**

**The three beats**

| Beat | What you see | Screen brightness (starting values) |
|---|---|---|
| 1. Thickening | Thin white mist at the cloud edge grows denser white. | Rises slowly to a **peak of about 65% of full white (Diego's pick)**, never pure white. |
| 2. Grey | The white settles into a soft, low-contrast grey. The cloud interior is vague, not bright. | Eases **down** to about 50%, so the brightest moment is brief and short of full. |
| 3. Clearing | Grey thins, then white mist, then the blue sky returns. | Eases back to the clear-sky level. |

The 65% peak is **Diego's pick** and is the cap. The grey (about 50%) and night (about 40%) values sit under it. They are still starting values for the build to check on Diego's screen, because I can't see his display. If any number looks too bright to him in a real build, the lower one wins.

**Hard limits (the "never flash" part)**
- **Slow ramps:** at least **5 s** each way (confirmed by Diego), **8 s** with `prefers-reduced-motion` or the "Calm" setting.
- **Slew cap:** the average screen brightness never changes by more than **6% of full range per second**, and never by more than **2% in a single frame**. This is checked by a test (below).
- **No pulsing at cloud edges:** the cloud amount comes from a **slow filter** on how close the craft is to a cloud, not a direct "inside / outside" test. Grazing a cloud edge or skimming two clouds in a row cannot make the screen pump. (1.12.4 switches the mix with `cloudImmersion(y)` and a puff-distance blend. 2.0 smooths it.)
- **Never white:** no full-screen white, no additive glow burst, no sun-ray surge inside a cloud. The sun glow dims in beat 1 instead of brightening.
- **No sudden darkening either:** the grey must not drop faster than the slew cap, so entering and leaving never "snaps".
- **Night:** the whole sequence is darker and the white peak is lower (about **40%**, confirmed by Diego), so night mode never brightens the screen.

**Readability inside a cloud**
- HUD plates are solid and keep their contrast (4.5:1 for text, 3:1 for icons) over every beat. The glider stays visible. The reticle (if on) gets an outline.
- The layer text reads "Inside the clouds" (already in all 9 tables), so the state is never shown by color or brightness alone. It has an icon and the words. No sound is involved.
- There is no collision, no penalty and no loss of control. A cloud is always optional to enter and easy to leave: steering never changes while inside.

**Settings (inclusion)**
- **Cloud mist: Soft (default) / Off.** Off keeps clouds solid-looking from outside and simply doesn't tint the screen, so the pass-through disappears. A light-sensitive student can choose Off with no loss of play.
- Reduced motion and Calm switch to the 8 s ramps automatically.

**Tests (added to the S15 flash audit; also runs in S5 for the sky world)**
- A script flies a fixed path through, past and along the edge of a cloud, at 1366x768, 1024x768 and 412x915, records every frame, and checks: peak average brightness at most the cap, per-frame step at most 2%, per-second change at most 6%, and no repeats of more than 3 brightness swings in one second.
- It runs for day and night, with Soft and Off, and with reduced motion on.
- The repo's `DRIFT-2-DESIGN.md` (section 10) says "no full-screen luminance step above about 15% within 200 ms". **This section is stricter and wins** for clouds.

---

## 1. What the sheet shows (estimates)

| Trait | What the images do | Failure it fixes |
|---|---|---|
| **Separation** | Almost every cloud has clear blue around it. A few broken bands sit low in the frame. | "Merged banks" |
| **Count** | About 15 to 30 distinct clouds per frame, with 1 to 3 big towering ones. | "Too few clouds on phone" (1.12.4 builds about 39 puffs on phone, 46 on desktop, for the whole sky) |
| **Size range** | Roughly 5 to 10 times between the smallest and largest cloud. No two alike. | Uniform-looking puffs |
| **Shading** | Bright white tops, soft blue-grey undersides, which give volume. | "Faint shadows" |
| **Edges** | Cauliflower shapes, soft but defined. Not smeared, not hard-cut. | Blobby or blurry puffs |
| **Sky** | Deep saturated blue, a little darker toward the top and corners. | Washed-out or white horizon band |
| **Coverage** | Roughly a quarter to under half of the frame is cloud. | Too empty or too full |

Note for a light-sensitive viewer: the sheet's whites are very bright. The game's cloud whites should sit **a little under** these, so the sky never glares. This is part of the pass check in section 4.

## 2. Limits and where things live

- **Two reference sources (Diego, Q2):** (a) **3 to 4 kept images from the Grok sheet**, and (b) **the `3e48cfe` frames** from the S0b harness. **No second "from above" or eye-level set will be generated.**
  - The sheet looks **up from the ground**, so it only covers the "undersides above" slice. Use it for shape, shading, spacing and colour, not for the camera view.
  - The `3e48cfe` frames are the **eye-level and cloud-top** reference. Because they come from a build with random cloud placement, S0b seeds it so the frames repeat.
  - Because the sheet and the `3e48cfe` frames don't share a camera angle, the pass numbers are set from **both**, not from the sheet alone (section 4).
- **Storage (Diego, Q3):** keep the images in **`shared/drift/visual-eval/refs/`**. Whether that folder exists yet is **unknown**: Managerbot creates it if it doesn't. The images **do not go in `trebiluk/drift`** (commit `1b6b5b7` keeps screenshots out), and **never in `public/`**.
- **Aspect:** the sheet is all 16:9. The phone needs 412x915 upright, so portrait crops are made from the kept images for the phone check. Nothing else is generated.
- **License: unknown.** I don't know the reuse terms for Grok Imagine output. Treat the images as **reference only**: never ship them, never trace them, never bundle them. Drift's clouds stay procedural, so no Credits entry is needed for them. Check with Diego if the terms matter before anything is shared outside the school.
- **Check each kept image** has no text, watermark or people. Sky-only is fine.
- **No reference image exists for the cloud pass.** That is judged by the brightness numbers in section 0.1 and by Diego's eye, not by a picture.

## 3. The picker ("go through them")

A single static page, `look-lock/picker.html`. No framework, no network, nothing uploaded.

**Loads:** you choose the image files with a file picker. They stay on the device.

**Browse:**
- One image at a time, fitted to the window, with the text "Image 3 of 12".
- Previous and Next buttons, at least 44 px, each with icon and word. Keys: Left, Right, Home, End.
- A thumbnail strip along the bottom. The current one is marked with a border and the word "Current", not by color alone.

**Decide (Diego keeps 3 to 4):**
- Three buttons, each with icon and word: **Keep**, **Maybe**, **Skip**. Keys K, M, S.
- A visible counter, "Kept 2 of 3 to 4". At the fourth Keep it says "4 of 4, full". A fifth Keep is refused with a text message, not a sound. Export is allowed with 3 or 4 Keeps and says "Pick 3 or 4" otherwise.
- The state shows on the strip as a word plus a shape, never color alone.
- An optional note, at most 80 characters, for example "good gaps". No names.

**Compare:** a toggle puts a kept image beside the game frame for the same pose and size (1366x768, 1024x768, or a 412x915 crop). This is how you check "does ours look like this". While the harness doesn't exist yet it shows a placeholder.

**Brightness note:** the picker shows each image's average brightness as a plain number, so the "a little under the sheet" rule in section 1 can be checked.

**Save:** picks are kept in the browser until you press **Export**, which downloads `refs.json` as `{file, decision, note}` per image. No alias, no personal info.

**Motion:** no slide animations, and it respects reduced motion. No flashing, and a dark neutral background so it is comfortable for a light-sensitive viewer.

**What Export drives:** the look-lock script reads `refs.json` and measures the **Keep** images (cloud coverage, number of distinct blobs, shadow contrast, average brightness).

## 4. S0, in two pastes

Each stays inside the paste limits (6,000 characters, 3 changes, 5 files).

### S0a. Picker (old tree, tooling only, no chip change)
- **Files:** `look-lock/picker.html`, `look-lock/refs.json` (empty template), `docs/crew/DRIFT-LOOK-LOCK.md`.
- **Changes:** (1) Browse, decide (with the 3 to 4 Keep counter) and export as in section 3. (2) Compare toggle with a placeholder until S0b makes game frames. (3) Write the section 1 traits and the section 0.1 limits into the look-lock doc.
- **Check at 1366x768, 1024x768 and 412x915:** all 12 images step with keys and with thumb; Keep, Maybe and Skip are readable without color; the 5th Keep is refused with text; no horizontal scroll; Export downloads a valid file.

### S0b. Harness
- **Files:** `scripts/look-lock.mjs` (poses inline), `package.json` (script line), `docs/crew/DRIFT-LOOK-LOCK.md`.
- **Changes:** (1) Play the game at fixed poses at the sizes above and save PNGs plus a 10 s frame-time CSV. (2) Seed-stub `Math.random` (via `addInitScript`) so `3e48cfe` renders the same every time. (3) Read `refs.json` and the `3e48cfe` frames and set thresholds.
- **Thresholds, with only 3 to 4 references:** use the **range** across the Keeps and the `3e48cfe` frame, not a median.
  - Distinct blobs: at least the **lowest** count in the set.
  - Coverage: within the **min to max** of the set, plus or minus 10%.
  - Shadow contrast: at least the **lowest** in the set.
  - Average brightness: **no higher than the sheet's Keeps**, so the sky never glares.
- **Check:** run on `3e48cfe` and `62af513`. Expect `62af513` to fail the blob count on phone (39 puffs) and the eye-level band test (section 0). Diego confirms the verdict matches his eye.

The cloud-pass checks (section 0.1) can't run until the cloud pass exists, so they are built into S5 and S15, not S0.

## 5. What changed from the last version of this doc

- The "from above" and eye-level generation set is **dropped** (Diego, Q2). The three prompts are removed. The eye-level reference is now the `3e48cfe` frames.
- The "in a cloud" rule is **rewritten** from "soft blue-grey mist at about 80%" to Diego's rule: denser white, then vague grey, then out, with a lower white cap (65%), slower ramps (5 s) and a measurable slew cap.
- Reference count is **3 to 4 total**, not per slice. If Diego meant 3 to 4 per slice, tell me and I'll restore the slice grouping.
- Thresholds use a **range** instead of a median, because 3 to 4 images is too few for a median.

## 6. Diego's answers and what's still open

| # | Question | Diego's answer | Where it landed |
|---|---|---|---|
| 1 | How many keepers | **3 to 4 reference images** | Sections 3 and 4 (counter, range thresholds) |
| 2 | Second eye-level set | **No. Use the `3e48cfe` frames** | Section 2 |
| 3 | Where images live | **`shared/drift/visual-eval/refs/`** | Section 2 |
| 4 | Flying through a cloud | **More densely white, then vague grey, then out. Slow ramp, cap the white well below full, never flash.** | Section 0.1 |

| 5 | White peak of the cloud | **About 65% of full white. Keep 5 s ramps and about 40% in night mode. No flash.** | Section 0.1 |

**No questions are open for Diego on this doc.**

**For Managerbot (not Diego):** create `shared/drift/visual-eval/refs/` if it doesn't exist, and keep the kept images and `refs.json` there. Nothing from this doc goes to `main`.

## 7. Unknowns

- Whether `shared/drift/visual-eval/refs/` exists. (Managerbot)
- The reuse terms for Grok Imagine output. (Diego)
- Whether Diego meant 3 to 4 images in total or per slice. I read it as total.
- Whether 65% feels right on Diego's own display in a real build. It is his pick and the cap, but nobody has seen it rendered yet. (Checked at S5.)
- How the 3 to 4 kept images compare with the `3e48cfe` frames until S0b runs: I haven't measured either.
