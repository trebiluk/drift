import React from 'react'
import { createRoot } from 'react-dom/client'
import pkg from '../package.json'

document.documentElement.dataset.version = pkg.version
document.documentElement.style.overflow = 'hidden'
document.body.style.overflow = 'hidden'
document.body.style.height = '100dvh'

const rootEl = document.getElementById('root')

function App() {
  return (
    <main
      style={{
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        background: '#8ec9f0',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#102033',
      }}
    >
      <p
        style={{
          margin: 0,
          padding: '0 24px',
          textAlign: 'center',
          fontSize: '28px',
          lineHeight: 1.3,
        }}
      >
        Drift 2.0 is coming
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
