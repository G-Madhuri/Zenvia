import { useState, useCallback } from 'react'

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  },
  modal: { background: '#fff', borderRadius: '1rem', overflow: 'hidden', maxWidth: 400, width: '90%' },
  header: { background: 'linear-gradient(135deg, #482790, #3a1f72)', color: 'white', padding: '1.2rem' },
  headerSuccess: { background: 'linear-gradient(135deg, #10b981, #059669)' },
  headerError: { background: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  headerWarning: { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  body: { padding: '1.5rem' },
  footer: { padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '1rem' },
  input: {
    width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0',
    borderRadius: '0.5rem', fontSize: '1rem', marginTop: '1rem', outline: 'none',
  },
}

// Singleton modal state — exported hook controls it
let _setModalState = null

export function useModal() {
  const show = useCallback((opts) => {
    return new Promise((resolve) => {
      _setModalState({ ...opts, resolve, visible: true })
    })
  }, [])

  const alert = (title, message, type = 'info') =>
    show({ title, message, type: 'alert', modalType: type })

  const confirm = (title, message) =>
    show({ title, message, type: 'confirm', modalType: 'warning' })

  const prompt = (title, message, placeholder = '', defaultValue = '') =>
    show({ title, message, type: 'prompt', placeholder, defaultValue, modalType: 'info' })

  return { alert, confirm, prompt }
}

export default function Modal() {
  const [state, setModalState] = useState({ visible: false })
  _setModalState = setModalState

  if (!state.visible) return null

  const { title, message, type, modalType, resolve, placeholder, defaultValue } = state
  const [inputVal, setInputVal] = useState(defaultValue || '')

  const headerStyle = {
    ...modalStyles.header,
    ...(modalType === 'success' ? modalStyles.headerSuccess : {}),
    ...(modalType === 'error' ? modalStyles.headerError : {}),
    ...(modalType === 'warning' ? modalStyles.headerWarning : {}),
  }

  const close = (val) => {
    setModalState({ visible: false })
    resolve(val)
  }

  return (
    <div style={modalStyles.overlay} onClick={(e) => e.target === e.currentTarget && close(type === 'prompt' ? null : false)}>
      <div style={modalStyles.modal}>
        <div style={headerStyle}><h3 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h3></div>
        <div style={modalStyles.body}>
          <p style={{ color: '#6e6e6e', lineHeight: 1.5 }}>{message}</p>
          {type === 'prompt' && (
            <input
              style={modalStyles.input}
              defaultValue={defaultValue}
              placeholder={placeholder}
              autoFocus
              onChange={(e) => setInputVal(e.target.value)}
            />
          )}
        </div>
        <div style={modalStyles.footer}>
          {type !== 'alert' && (
            <button className="btn-secondary" onClick={() => close(type === 'prompt' ? null : false)}>
              Cancel
            </button>
          )}
          <button
            className="btn-primary"
            style={{ padding: '0.5rem 1rem' }}
            onClick={() => close(type === 'prompt' ? inputVal : true)}
          >
            {type === 'alert' ? 'OK' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
