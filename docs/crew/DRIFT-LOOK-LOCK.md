# Drift look lock (S0b)

The harness for stage S0b in `DRIFT-2-DESIGN.md` §12 and `DRIFT-LOOK-LOCK-REFS.md` §4. It is tooling only, with no chip change.

## What it does

`drift-next/scripts/look-lock.mjs` photographs **any Drift build at any URL** the same way every time:
- 4 viewports (1366×768, 1024×768, 412×915, 915×412) and 2 poses (3 s and 8 s of flight with no input);
- `Math.random` is seeded, so builds that place clouds with it (`3e48cfe`) repeat;
- a **fake clock**, so a pose is the same frame every run. Some 1.x builds stall on it; the harness then switches to real time and says so in the report (`clock: real`).

Every picture gets 4 numbers:

| Number | What it means | Failure it catches |
|---|---|---|
| **coverage** | share of the frame that is cloud (light, low-colour pixels) | too empty, too full |
| **blobs** | separate clouds bigger than 0.05% of the frame | merged banks, too few clouds |
| **shadow** | brightness spread inside clouds (90th − 10th percentile) | flat, faint clouds |
| **bright** | mean brightness of the whole frame (same weights as the guard) | glare for a light-sensitive viewer |

It also records **10 s of real frame gaps** with the CPU 4× slower (the Chromebook-floor stand-in) and writes one CSV per viewport.

The harness doesn't build anything and needs no npm packages: only Playwright, installed globally is fine.

```bash
# shoot a build (pictures go OUTSIDE this repo, for example apps-kulibert shared/drift/visual-eval/)
node drift-next/scripts/look-lock.mjs --url http://localhost:8768/ --out /tmp/look --label next
node drift-next/scripts/look-lock.mjs --url "http://localhost:8768/?q=balanced" --out /tmp/look --label next-gl
node drift-next/scripts/look-lock.mjs --url https://apps.kulibert.net/drift/ --out /tmp/look --label live --start "button[aria-label=Start]"

# compare with Diego's kept references (refs.json from the picker plus the images), optionally plus 3e48cfe frames
node drift-next/scripts/look-lock.mjs --compare /tmp/look/next.json --refs shared/drift/visual-eval/refs --ref-frames a.png,b.png
```

**Thresholds** come from the 3–4 kept images plus the `3e48cfe` frames. They use the **range** across them, never a median:
- blobs ≥ the lowest;
- coverage within min–max ± 10%;
- shadow ≥ the lowest;
- brightness ≤ the brightest Keep.

Diego's eye has the last word.

## First baseline (Nov 4 2026, software GPU, so the speeds aren't real-GPU numbers)

| Build | Coverage | Blobs | Shadow | Brightness | Frames at 4× slow |
|---|---|---|---|---|---|
| drift-next 2.0.0-j, `still` (2D) | 1.5–5.1% | 4–8 | 2–42% | 51–52% | steady (no long gaps) |
| drift-next 2.0.0-j, `?q=balanced` (WebGL) | 4.6–12.7% | 10–13 | 8–27% | 47–53% | — |
| live 1.12.5 (clock: real) | 2.8–4.0% | 7–18 | 37–46% | 36–39% | **2–6 fps** |

**What it already shows**, before any reference is picked:
- Both builds are **far emptier** than the reference sheet (about 25–50% coverage and 15–30 clouds per frame, `DRIFT-LOOK-LOCK-REFS.md` §1).
- **"In the clouds" isn't met yet**, by either build.
- drift-next's 2D tier stays smooth where 1.12.5 drops to single digits on a software GPU.

## S0a, the picker

Open `drift-next/look-lock/picker.html` straight from disk; it needs no server, no network and no build.

1. **Choose images:** pick the 12 sheet images. They stay on the device.
2. **Look:**
   - Previous and Next buttons, or the arrow keys (Home and End jump to the ends).
   - The strip marks the current image with a thick border and the word "Current".
   - Each image shows its average brightness as a number.
3. **Decide:**
   - **Keep**, **Maybe** or **Skip**, with the buttons or K, M, S.
   - The counter reads "Kept 2 of 3 to 4", then "Kept 4 of 4, full".
   - A 5th Keep is refused with a text message.
   - An optional note of up to 80 characters, with no names.
4. **Compare (optional):** choose game frames from `look-lock.mjs`, and they show beside the reference.
5. **Export:** allowed only with 3 or 4 Keeps. It downloads `refs.json` as `{file, decision, note}`.
6. Put `refs.json` beside the kept images in `shared/drift/visual-eval/refs/` (apps-kulibert), then run `--compare`.

Picks are remembered in the browser until you press Export or Clear.

**Tested** at 1366×768, 1024×768 and 412×915 with 12 made-up sky images:
- keys and buttons work; the 5th Keep is refused; Home and End work;
- no sideways scroll, and every control is 44 px or more;
- 0 network requests and 0 console errors;
- Export gives a valid file, and `--compare` reads it end to end.

## Quick runs

`--viewports 1366x768,412x915` shoots only those sizes, and `--no-timing` skips the frame-time pass. Together they take about a minute.

## First S5 try (Nov 4, not shipped)

**Variant A:** clouds spread evenly over a 2,400-unit tile, radius 24–150, and 40 discs on the 2D tier.
- **2D tier:** coverage goes from 2–3% to 5–7%.
- **WebGL `balanced`:** 5–11% becomes 7–10%, but with **fewer separate clouds** (13 down to 4–6, so bigger clumps).
- **Brightness:** unchanged, 47–52%.

It **broke the fade test** (`a cloud fades in and out smoothly…`): the wrap tile must stay **at least 2× the 1,500-unit fade distance**, so FIELD can't go below about 3,000. Reverted.

**Lesson:** density alone won't reach the references. The reference sheet looks **up from the ground**, while the game looks **along the horizon**, with half the frame below it. Before tuning S5 further, Diego picks the references (picker) and we agree which numbers apply to the sky half only.

## Still to do

- **Diego runs the picker** on the real Grok sheet images and keeps 3 or 4.
- **A `3e48cfe` build** to shoot, which needs a machine with npm.
- **`shared/drift/visual-eval/refs/`** in apps-kulibert, for the kept images. They never go in this repo or in `public/`.
