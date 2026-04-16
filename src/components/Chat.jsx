import { useState, useRef, useEffect } from 'react'

export default function Chat({ messages, onGuess, isDrawer, phase }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const canGuess = !isDrawer && phase === 'drawing'

  const submit = () => {
    const text = input.trim()
    if (!text || !canGuess) return
    onGuess(text)
    setInput('')
  }

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.map((msg, i) => {
          if (msg.system) {
            return <div key={i} className="chat-system">{msg.text}</div>
          }
          return (
            <div key={i} className={`chat-msg ${msg.correct ? 'correct' : ''}`}>
              <span className="chat-name">{msg.name}</span>
              <span className="chat-text">{msg.text}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-footer">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={
            isDrawer ? 'You are drawing…' :
            phase === 'drawing' ? 'Type your guess…' :
            'Waiting…'
          }
          disabled={!canGuess}
        />
        <button className="chat-send" onClick={submit} disabled={!canGuess}>↵</button>
      </div>
    </div>
  )
}
