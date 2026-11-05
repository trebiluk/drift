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
import { HUD } from './i18n/hud.ts'

document.documentElement.dataset.version = pkg.version
document.documentElement.style.overflow = 'hidden'
document.body.style.overflow = 'hidden'
document.body.style.height = '100dvh'

const rootEl = document.getElementById('root')

function App() {
  const host = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLElement>(null)
  const hint = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!host.current || !shell.current) return
    const demo = mountDemo(host.current, { version: pkg.version, debug: wantsDebug(window.location.search) })
    let store: Storage | null = null
    try {
      store = window.localStorage
    } catch {
      store = null
    }
    // The hint line says how to steer, and says so when Watch is flying (S8 will pick the language; English for now).
    let padOn = false
    let watchOn = false
    const showHint = () => {
      if (hint.current) hint.current.textContent = watchOn ? HUD.en.hintWatch : padOn ? HUD.en.hintPad : HUD.en.hint
    }
    // Steer pad (option, off by default): the switch lives in the Pause panel, the pad at the bottom left.
    const steerPad = mountSteerPad(document, document.body, store, (a) => demo.setPad(a.yaw, a.pitch), (on) => {
      padOn = on
      showHint()
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
    // Pause (button, P, Esc, a hidden tab) freezes the flight; the panel offers Resume and Home.
    const pause = mountPause(document, shell.current, { onPause: () => { steerPad.clear(); demo.setPaused(true) }, onResume: () => demo.setPaused(false), extra: [steerPad.option, trackOption.option] })
    // The steer pad sits just above the hint line, however many lines the hint wraps to.
    const sizeHint = () => {
      if (hint.current) document.documentElement.style.setProperty('--ds-hint-h', `${Math.ceil(hint.current.getBoundingClientRect().height)}px`)
    }
    sizeHint()
    const hintObs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sizeHint)
    if (hint.current) hintObs?.observe(hint.current)
    // Watch (off by default): the glider flies itself in slow turns; steering takes over, then Watch eases back in.
    const watch = mountWatch(document, document.body, store, (on) => {
      watchOn = on
      demo.setWatch(on)
      showHint()
    })
    const sound = mountSound(document, document.body, ambient, store)
    soundUi = sound
    sound.setTrackWord(trackName(trackOption.track()))
    // Speed: 5 notches, buttons and Q/E; the sim eases to each one.
    const speed = mountSpeed(document, document.body, DEFAULT_NOTCH, (c) => demo.setCruise(c))
    return () => {
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
        {HUD.en.hint}
      </p>
      <div
        style={{
          position: 'fixed',
          right: 'max(16px, env(safe-area-inset-right))',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          margin: 0,
          padding: '8px 14px',
          borderRadius: '999px',
          background: '#ffffff',
          color: '#111111',
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
