## 2.0.0-w

Layouts for phones and Chromebooks (S7 step 3). On an upright phone with "Steer with buttons" on, the steer pad covered the glider; now the glider sits just above whatever docks reach across the middle of the screen (the pad on a phone), and goes back to its usual low spot when the pad is off or the phone is turned sideways. It never goes above the horizon line. Tab now follows the screen: Watch, Pause, Sound, then the steer pad and Speed. The version tag is a dark plate like the rest of the HUD instead of a white patch on the sky. Checked at 412×915, 360×640, 915×412, 1024×768 and 1366×768: nothing overlaps, nothing is off screen, 0 errors.

## 2.0.0-v

Calm sound tracks, for relaxing or studying, as in 1.12.4: **Calm** (the soft pad), **Rain**, **Ocean** and **Bowls**. All four are made in the browser (no recordings to license or download). Rain is soft filtered noise; Ocean is deep noise that swells like slow waves; Bowls are rubbed singing bowls that swell in over 2.5 s, never struck, every 14 to 22 s. Pick one in the Pause panel ("Sound track: Rain"); switching cross-fades over 2.5 s. While sound is on, the Sound button names the track in words ("Sound: On · Rain"), so nothing is only heard. Choosing a track never turns sound on: Sound is still Off on a first visit, and pausing or hiding the tab fades every track out. Words in all 9 tables (drafts).

## 2.0.0-u

Watch: a hands-free glide for relaxing or studying, as in 1.12.4. A "Watch: Off" button at the top left (48 px, an eye icon and words; On also shows a border). Turned on, the glider flies itself in slow, lazy turns left and right through the clouds, with the nose held level. Steering in any way (keys, drag or the steer pad) takes over at once; 2.5 s after you let go, Watch eases back in over 3 s, so the picture never jerks. Speed works as normal. The hint line says "Watch is flying. Steer any time to take over." Gentler turns with reduced motion. Off on a first visit, remembered in this browser. Its words are in all 9 tables (machine drafts).

## 2.0.0-t

More clouds to steer through. Clouds are bigger and fuller (radius 32 to 192, from 18 to 120), and a little more of the field sits near you, so there is always cloud beside you with blue gaps between. The two cheapest tiers draw more of them (Lite 48 → 64, the 2D floor 24 → 36), so a Chromebook sky isn't empty. Measured cloud in the top half of the frame: about 50 to 55% on the best tiers at 1366, 35% on Lite, 27% on the 2D floor; on a phone 29 to 31%, 20% and 13%. Frame rate with the CPU 4× slower is unchanged (2D floor 60 fps; Lite 22 → 24 fps on a software GPU). Brightness stays at 45 to 52%, under the 58% cap. Tooling: the look-lock harness now counts shaded and soft-edged cloud as cloud (it only counted white tops, so it under-read every build), and reports the sky half too.

## 2.0.0-s

A deep blue sky with fluffy white clouds (Diego: "the main core is the fluffy clouds with the deep blue sky"). The sky is a richer, deeper blue overhead and a clear blue at the horizon. Every cloud has a sunlit top and a soft blue-grey base, on every tier: the two cheapest tiers, which drew flat discs, now draw small cumulus shapes (a dome and two side bumps on a flatter base). No cloud pixel got brighter. The deeper sky makes the clouds look whiter, and the picture's average brightness went down (about 52% to 48% on the best tier, 51% to 46% on the 2D floor; Diego's cap is 58%).

## 2.0.0-r

Every word on the flight screen is ready in 8 languages and Simple (English, Simple, Spanish, Ukrainian, Russian, Arabic, Dari, Kinyarwanda, Tigrinya), in one table (`src/i18n/hud.ts`) for the language stage (S8) to switch on. All but English are machine drafts waiting for a native reader; Arabic and Dari are marked right to left; digits stay 1, 2, 3 until Diego picks. Kids see one change today: with "Steer with buttons" on, the hint line says "Drag, use the arrow keys, or hold the buttons to steer".

## 2.0.0-q

The "Tap to start sound" note now shows only when it should: when Sound was saved as On and is waiting for the first tap or key. Before this it showed on every visit, even with Sound Off, because its style overrode the hidden setting. The Pause button had the same fault: it stayed drawn on top of the Pause panel while paused. It now hides while the panel is open, and comes back on Resume. Nothing else changes.

## 2.0.0-p

Steer with buttons, for kids who can't drag. The Pause panel has a new switch, "Steer with buttons: Off" (Off on a first visit, remembered in this browser). Turned On, a pad of four buttons sits at the bottom left: ◀ ▲ ▼ ▶, 56 px each, with names a screen reader says ("Steer left", "Nose up"). Hold a button to steer and let go to level out, the same as the arrow keys; two at once steer both ways. A held button shows a brighter border and fill as well as the arrow, and Space or Enter hold a focused button. Pausing or leaving the tab lets go of every button. Same dark plate as Pause and Speed.

## 2.0.0-o

Speed you can see and change. A Speed dock at the bottom right has 5 notches, from Slowest to Fastest, shown as a number, a word and filled bars (never colour alone), with ▲ Faster and ▼ Slower buttons (48 px, icon and text). Q and E, or − and +, do the same from the keyboard, and the dock is a slider that a screen reader reads as "Speed 2 of 5, Slow". It starts on notch 2, the same speed as before, and the glider eases to a new speed instead of jumping. It uses the same dark plate as Pause, never brighter than the sky.

## 2.0.0-n

Pause and soft sound together. This brings 2.0.0-k (Pause and Home) and 2.0.0-l/m (soft ambient sound, Off by default) onto one build, with the look-lock harness and picker as tooling (no change for kids). The Sound button now sits under Pause (both at the top right, 48 px, no overlap); before this they were drawn on top of each other.

## 2.0.0-m

Settings icon (Sound button) stays fully on screen with safe-area inset (right >= 8px + env(safe-area-inset-right)). When the saved choice is On, the AudioContext does not start until the first tap or key on this page load; a calm "Tap to start sound" hint (icon + text) shows until then. Focus ring uses :focus-visible so mouse clicks leave none.

## 2.0.0-l

Soft ambient sound, muted by default. A calm pad of three soft voices (sine and triangle, low notes, a slowly sweeping filter) that drifts to another chord every 18 to 30 seconds with a slow glide, never going back and forth and never repeating a stretch it just played. A Sound button (top right, icon and text, "Sound: Off" or "Sound: On") or the M key turns it on or off; it is Off on a first visit and the choice is remembered in this browser. Sound starts only after a click, tap or key, fades in and out over 2.5 seconds with no clicks, and fades out when the tab is hidden. It is a little louder when flying faster (the audio side is ready; the speed feed waits on the pause work in PR #6, see the PR).
## 2.0.0-k

A calm way to stop. A Pause button (icon and text, top right) is always on screen while flying, and P or Esc do the same. Pausing freezes the flight and the picture, and a small panel offers Resume (focused first) and Home, which goes to the hub on the same site. Hiding the tab pauses too, and the panel is already there on return. The panel is a blue-grey card at about the picture's own brightness, never white, and fades in over 200 ms (no fade with reduced motion). Esc or P on the panel resumes; Tab stays inside the panel; the time spent paused is never flown.

## 2.0.0-j

The real picture behind the tiers, drawn with plain WebGL2 (no new package: `three` is not installed and the registry is unreachable, and adding it would break the lockfile). Lite draws soft flat clouds over a flat floor; Normal adds three lit lobes per cloud, relief on the floor and round cloud shadows; Fancy adds five lobes with a wobbling edge and a lit rim, distance haze, shadows squashed by the view angle and a hazy horizon. Still, and any browser without WebGL2, draws the same world in Canvas 2D. The frame-rate governor steps the tier down on slow frames and back up with headroom (`?debug=1` now shows the tier, fps, bank angle and which drawer is in use). The brightness guard and the 25 degree bank cap are unchanged, and brightness was re-measured on the real picture at clear sky, on a cloud approach and inside a cloud on every tier: the guard's veil stayed at 0% and nothing moved more than 3.5% in a second. When the picture changes how it is drawn (first frame, a lost or restored WebGL context, a climb back to WebGL), or on the 2D picture when a tier step adds or removes clouds, a thin cover matches the new picture to what was on screen and lets the difference close at about one point a second, so none of these shows as a jump over 2%. The page colour is now `#5586b6` on the page, body and theme colour so the first paint matches the picture. No farmland, no god rays, no glow. Not run here: `npm install`, `npm test`, `vite build`, real React, a real GPU or Chromebook (software GL is only a proxy).

## 2.0.0-i

A brightness guard and a gentler tilt. The guard watches the picture that actually reaches the screen and, if its average brightness ever passes 58%, lays a dark veil over it until it is back at 58%; in normal play (clear sky about 51%, worst cloud about 56%) it never switches on. The glider now banks at most 25 degrees against the horizon, down from about 57; reduced motion still draws no tilt. ?debug=1 shows the bank angle, the brightness and the veil on a new line; ?debug=1&cap=45 lowers the cap to 45% so a tester can watch the guard work. No lockfile yet: npm could not be reached while this was written, so RepoCoder generates package-lock.json.

## 2.0.0-h

Real sky and clouds: the quality tiers, start probe and frame governor now run the demo (?debug=1 shows the tier; ?q=light pins one). The sky and clouds are darker and off-white, about half brightness in clear sky and never pure white. Flying into a cloud fades to a soft tinted haze and back out, and never gets brighter than the sky. Reduced motion keeps the fade, slower, with no tilt.

## 2.0.0-g

First moving frame: a frame loop (cap 60, drops to 30 when frames run long, pauses when the tab is hidden), a ?debug=1 readout, and a glider you can steer with a mouse, a finger or the arrow keys.

## 2.0.0-f

Frame-rate governor: drops fast on stutter (95th percentile), climbs slowly, never retries a failed tier, ignores single hitches, honours a low-power cap, and gives up on WebGL after a second lost context. Tests only.

## 2.0.0-e

Quality tiers and the start probe: no WebGL, a software GPU, WebGL1, Chromebooks and low-power devices begin lighter. Never starts on full. Tests only.

## 2.0.0-d

Cloud fly-through logic: slow white (peak 65%, 40% at night), grey, then clear. Never a flash. Tests only, no picture yet.

## 2.0.0-c

Flight sim and pull-steer input, with tests.

## 2.0.0-b

Inline empty favicon so hard reload has no console error.

## 2.0.0-a

Drift 2.0 scaffold: page and version chip.
