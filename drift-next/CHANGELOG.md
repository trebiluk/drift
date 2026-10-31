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
