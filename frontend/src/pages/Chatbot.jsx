import { useState, useEffect, useRef } from 'react'
import './Chatbot.css'

export default function Chatbot() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState({ text: '🔄 Connecting...', cls: 'connecting' })
  const [dark, setDark] = useState(false)
  const messagesEndRef = useRef(null)
  const chatHistory = useRef([])

  useEffect(() => {
    // Health check
    fetch('/api').then(r => {
      setStatus(r.ok ? { text: '✅ Connected', cls: 'connected' } : { text: '❌ Backend Error', cls: 'disconnected' })
    }).catch(() => setStatus({ text: '❌ Cannot Connect', cls: 'disconnected' }))

    // Welcome message
    setMessages([{ type: 'welcome' }])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isProcessing) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setIsProcessing(true)
    setMessages(prev => [...prev, { role: 'typing' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatHistory: chatHistory.current }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const reply = data.response

      setMessages(prev => [...prev.filter(m => m.role !== 'typing'), { role: 'bot', content: reply }])
      chatHistory.current.push({ role: 'user', content: text })
      chatHistory.current.push({ role: 'assistant', content: reply })
    } catch (err) {
      setMessages(prev => [...prev.filter(m => m.role !== 'typing'), {
        role: 'bot', content: "I'm having trouble connecting. Make sure the Flask backend is running. 🔄"
      }])
    }
    setIsProcessing(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatBot = (text) => ({
    __html: text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  })

  return (
    <div className={`app-container ${dark ? 'dark' : ''}`}>
      <div className={`connection-status ${status.cls}`}>{status.text}</div>

      <header className="chat-header">
        <div className="chat-logo">👗 FashionBot</div>
        <button className="theme-toggle" onClick={() => setDark(d => !d)}>
          {dark ? '☀️' : '🌙'}
        </button>
      </header>

      <main className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => {
            if (msg.type === 'welcome') return (
              <div key={i} className="welcome-message">
                <h3>Welcome to FashionBot!</h3>
                <p>Your fashion assistant. Ask me anything about style, trends, or outfit advice!</p>
              </div>
            )
            if (msg.role === 'typing') return (
              <div key={i} className="message bot">
                <div className="message-avatar">F</div>
                <div className="message-content">
                  <strong>FashionBot is thinking</strong>
                  <span className="typing-dots">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </span>
                </div>
              </div>
            )
            return (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-avatar">{msg.role === 'user' ? 'Y' : 'F'}</div>
                <div className="message-content">
                  {msg.role === 'bot'
                    ? <span dangerouslySetInnerHTML={formatBot(msg.content)} />
                    : msg.content}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message FashionBot..."
              rows={1}
            />
            <button className="send-button" onClick={sendMessage} disabled={isProcessing}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22,2 15,22 11,13 2,9" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
