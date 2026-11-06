/**
 * The "Sound track" choice in the Pause panel (DRIFT-2-DIRECTION step 5): one button that steps Calm → Rain → Ocean →
 * Bowls. Its label always says the track in words ("Sound track: Rain"), and while sound is on the Sound button says it
 * too ("Sound: On · Rain"), so no state is only heard. Choosing a track never turns sound on: that stays the Sound
 * button's job, and Sound stays Off on a first visit. The choice is kept in this browser.
 */
import { TRACK_TEXT, nextTrack, readTrack, trackName, writeTrack, type Track } from "../audio/tracks.ts"

type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined

export const trackOptionLabel = (t: Track) => `${TRACK_TEXT.label}: ${trackName(t)}`

const ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M7 13.5V3.5l8-2v10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="5" cy="13.5" r="2.2" fill="currentColor"/><circle cx="13" cy="11.5" r="2.2" fill="currentColor"/></svg>'

export type TrackOption = { option: HTMLButtonElement; track: () => Track; unmount: () => void }

/** Builds the button (a `.dp-btn` for the Pause panel). `onChange(track)` is called at mount and on every change. */
export function mountTrackOption(doc: Document, store: Store, onChange: (t: Track) => void): TrackOption {
  const option = doc.createElement("button")
  option.type = "button"
  option.className = "dp-btn"
  let track = readTrack(store)
  const draw = () => {
    option.innerHTML = `${ICON}<span>${trackOptionLabel(track)}</span>`
    onChange(track)
  }
  const onClick = () => {
    track = nextTrack(track)
    writeTrack(store, track)
    draw()
  }
  option.addEventListener("click", onClick)
  draw()
  return {
    option,
    track: () => track,
    unmount: () => {
      option.removeEventListener("click", onClick)
      option.remove()
    },
  }
}
