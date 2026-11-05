import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import pkg from '../package.json'
import { PAGE_BG } from './render/page.ts'
import { mountDemo } from './ui/demo.ts'
import { mountPause } from './ui/pause.ts'
import { DEFAULT_NOTCH, mountSpeed } from './ui/throttle.ts'
import { wantsDebug } from './ui/debug.ts'
import { createAmbient } from './audio/ambient.ts'
import { mountSound } from './ui/sound.ts'
import { mountSteerPad } from './ui/steerpad.ts'

document.documentElement.dataset.version = pkg.version
document.documentElement.style.overflow = 'hidden'
document.body.style.overflow = 'hidden'
document.body.style.height = '100dvh'

const rootEl = document.getElementById('root')

function App() {
  const host = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!host.current || !shell.current) return
    const demo = mountDemo(host.current, { version: pkg.version, debug: wantsDebug(window.location.search) })
    let store: Storage | null = null
    try {
      store = window.localStorage
    } catch {
      store = null
    }
    // Steer pad (option, off by default): the switch lives in the Pause panel, the pad at the bottom left.
    const steerPad = mountSteerPad(document, document.body, store, (a) => demo.setPad(a.yaw, a.pitch))
    // Pause (button, P, Esc, a hidden tab) freezes the flight; the panel offers Resume and Home.
    const pause = mountPause(document, shell.current, { onPause: () => { steerPad.clear(); demo.setPaused(true) }, onResume: () => demo.setPaused(false), extra: [steerPad.option] })
    // Soft ambient pad, Off until the player turns it on (button or M); the audio starts only on that click, tap or key.
    const ambient = createAmbient(() => (typeof AudioContext === 'undefined' ? null : new AudioContext()))
    const sound = mountSound(document, document.body, ambient, store)
    // Speed: 5 notches, buttons and Q/E; the sim eases to each one.
    const speed = mountSpeed(document, document.body, DEFAULT_NOTCH, (c) => demo.setCruise(c))
    return () => {
      speed.unmount()
      steerPad.unmount()
      sound.unmount()
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
          maxWidth: 'calc(100vw - 120px)',
          pointerEvents: 'none',
        }}
      >
        Drag to steer, or use the arrow keys
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
