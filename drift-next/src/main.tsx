import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import pkg from '../package.json'
import { mountDemo } from './ui/demo.ts'
import { wantsDebug } from './ui/debug.ts'

document.documentElement.dataset.version = pkg.version
document.documentElement.style.overflow = 'hidden'
document.body.style.overflow = 'hidden'
document.body.style.height = '100dvh'

const rootEl = document.getElementById('root')

function App() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current) return
    return mountDemo(host.current, { version: pkg.version, debug: wantsDebug(window.location.search) })
  }, [])
  return (
    <main
      style={{
        position: 'relative',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        background: '#8ec9f0',
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
