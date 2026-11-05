import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import pkg from '../package.json'
import { PAGE_BG } from './render/page.ts'
import { mountDemo } from './ui/demo.ts'
import { mountPause } from './ui/pause.ts'
import { DEFAULT_NOTCH, mountSpeed } from './ui/throttle.ts'
import { wantsDebug } from './ui/debug.ts'
import { createAmbient } from './audio/ambient.ts'
import { installTracks, trackName } from './audio/tracks.ts'
import { mountTrackOption } from './ui/soundtrack.ts'
import { mountSound } from './ui/sound.ts'
import { mountSteerPad } from './ui/steerpad.ts'
import { mountWatch } from './ui/watch.ts'
import { markPage, pickLang, useLang, words } from './i18n/lang.ts'
import { rectOf, type Rect } from './ui/layout.ts'

document.documentElement.dataset.version = pkg.version
document.documentElement.style.overflow = 'hidden'
document.body.style.overflow = 'hidden'
document.body.style.height = '100dvh'

// S8: the player's language, from the Hub's setting (or ?lang=), put into every HUD word before anything is built.
let prefsStore: Storage | null = null
try {
  prefsStore = window.localStorage
} catch {
  prefsStore = null
}
const LANG = pickLang(window.location.search, prefsStore)
const DRAFT_NOTE = useLang(LANG)
markPage(document, LANG)

const rootEl = document.getElementById('root')

function App() {
  const host = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLElement>(null)
  const hint = useRef<HTMLParagraphElement>(null)
  const chip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current || !shell.current) return
    const demo = mountDemo(host.current, { version: pkg.version, debug: wantsDebug(window.location.search) })
    let store: Storage | null = null
    try {
      store = window.localStorage
    } catch {
      store = null
    }
    // The hint line says how to steer, and says so when Watch is flying, in the player's language.
    let padOn = false
    let reportDocksRef = () => {}
    let watchOn = false
    const showHint = () => {
      if (hint.current) hint.current.textContent = watchOn ? words().hintWatch : padOn ? words().hintPad : words().hint
    }
    // Steer pad (option, off by default): the switch lives in the Pause panel, the pad at the bottom left.
    const steerPad = mountSteerPad(document, document.body, store, (a) => demo.setPad(a.yaw, a.pitch), (on) => {
      padOn = on
      showHint()
      requestAnimationFrame(() => reportDocksRef())
    })
    // Soft calm sound, Off until the player turns it on (button or M); the audio starts only on that click, tap or key.
    // Four tracks (Calm, Rain, Ocean, Bowls), all made in the browser; the choice is in the Pause panel.
    installTracks()
    const ambient = createAmbient(() => (typeof AudioContext === 'undefined' ? null : new AudioContext()))
    let soundUi: { setTrackWord: (w: string) => void } | null = null
    const trackOption = mountTrackOption(document, store, (t) => {
      ambient.setTrack(t)
      soundUi?.setTrackWord(trackName(t))
    })
    // Tab goes the way the screen reads: Watch (top left), Pause and Sound (top right), then the steer pad and Speed
    // (bottom). So Watch, Pause and Sound go in the page itself, in that order, and the bottom docks after it.
    // Watch (off by default): the glider flies itself in slow turns; steering takes over, then Watch eases back in.
    const watch = mountWatch(document, shell.current, store, (on) => {
      watchOn = on
      demo.setWatch(on)
      showHint()
    })
    // Pause (button, P, Esc, a hidden tab) freezes the flight; the panel offers Resume and Home.
    const pause = mountPause(document, shell.current, { onPause: () => { steerPad.clear(); demo.setPaused(true) }, onResume: () => demo.setPaused(false), extra: [steerPad.option, trackOption.option], note: DRAFT_NOTE })
    // The steer pad sits just above the hint line, however many lines the hint wraps to.
    const sizeHint = () => {
      if (hint.current) document.documentElement.style.setProperty('--ds-hint-h', `${Math.ceil(hint.current.getBoundingClientRect().height)}px`)
    }
    sizeHint()
    const hintObs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sizeHint)
    if (hint.current) hintObs?.observe(hint.current)
    const sound = mountSound(document, shell.current, ambient, store)
    soundUi = sound
    sound.setTrackWord(trackName(trackOption.track()))
    // Speed: 5 notches, buttons and Q/E; the sim eases to each one.
    const speed = mountSpeed(document, document.body, DEFAULT_NOTCH, (c) => demo.setCruise(c))
    // The glider sits above whichever bottom docks reach over the middle of the screen (ui/layout.ts): on an upright
    // phone that is the steer pad. Re-measured whenever a dock changes size, comes, goes, or the window turns.
    const dockEls = () => [document.querySelector('.ds-pad'), document.querySelector('.ds-speed'), hint.current, chip.current]
    const reportDocks = () => demo.setDocks(dockEls().map(rectOf).filter((r): r is Rect => r !== null))
    reportDocks()
    reportDocksRef = reportDocks
    const dockObs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reportDocks)
    for (const el of dockEls()) if (el) dockObs?.observe(el)
    window.addEventListener('resize', reportDocks)
    return () => {
      window.removeEventListener('resize', reportDocks)
      dockObs?.disconnect()
      speed.unmount()
      steerPad.unmount()
      watch.unmount()
      hintObs?.disconnect()
      sound.unmount()
      trackOption.unmount()
      pause.unmount()
      demo.stop()
    }
  }, [])
  return (
    <main
      ref={shell}
      style={{
        position: 'relative',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        background: PAGE_BG,
        margin: 0,
        fontFamily: 'system-ui, sans-serif',
        color: '#102033',
      }}
    >
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      <p
        ref={hint}
        style={{
          position: 'fixed',
          left: 'max(12px, env(safe-area-inset-left))',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          margin: 0,
          padding: '8px 12px',
          borderRadius: '10px',
          background: 'rgba(8, 16, 30, 0.82)',
          color: '#f2f6fb',
          fontSize: '14px',
          lineHeight: 1.3,
          // Never under the Speed dock (bottom right, about 140 px with its gap) at any width.
          maxWidth: 'calc(100vw - 168px)',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        {words().hint}
      </p>
      <div
        ref={chip}
        style={{
          position: 'fixed',
          right: 'max(16px, env(safe-area-inset-right))',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          margin: 0,
          padding: '8px 14px',
          borderRadius: '999px',
          // A dark plate like every other HUD plate: never a white patch on the sky.
          background: 'rgba(8, 16, 30, 0.82)',
          color: '#f2f6fb',
          fontSize: '14px',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        v{pkg.version}
      </div>
    </main>
  )
}

if (rootEl) {
  createRoot(rootEl).render(<App />)
}
