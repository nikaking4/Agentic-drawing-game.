import { useState, useEffect, useRef, useCallback } from 'react'
import Lobby from './components/Lobby'
import Canvas from './components/Canvas'
import Chat from './components/Chat'
import GameHeader from './components/GameHeader'
import './App.css'

const WS_URL = 'ws://localhost:3001'

export default function App() {
  const [myId, setMyId] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const canvasRef = useRef(null)
  const prevRoundIndex = useRef(0)

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      switch (msg.type) {
        case 'welcome':
          setMyId(msg.id)
          break
        case 'state':
          setGameState(msg.state)
          break
        case 'chat':
          setMessages(prev => [...prev, msg])
          break
        case 'draw':
          canvasRef.current?.handleDrawEvent(msg.data)
          break
        case 'correct_guess':
          setMessages(prev => [...prev, {
            system: true,
            text: `🎉 ${msg.name} guessed it! +${msg.pts} pts`,
          }])
          break
      }
    }

    return () => ws.close()
  }, [])

  useEffect(() => {
    if (!gameState) return
    if (gameState.roundIndex !== prevRoundIndex.current && gameState.roundIndex > 1) {
      prevRoundIndex.current = gameState.roundIndex
      setMessages(prev => [...prev, { system: true, text: `── Round ${gameState.roundIndex} ──` }])
    } else {
      prevRoundIndex.current = gameState.roundIndex
    }
  }, [gameState?.roundIndex])

  if (!connected) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p>Connecting…</p>
      </div>
    )
  }

  if (!myId || !gameState) {
    return <div className="center-screen"><div className="spinner" /></div>
  }

  const { phase, players, currentRound, roundIndex, totalRounds } = gameState
  const myPlayer = players.find(p => p.id === myId)

  if (!myPlayer) {
    return (
      <JoinForm
        onJoin={(name) => send({ type: 'join', name })}
        playerCount={players.filter(p => p.connected).length}
      />
    )
  }

  if (phase === 'lobby') {
    return (
      <Lobby
        players={players}
        myPlayer={myPlayer}
        onSubmitWords={(words) => send({ type: 'submit_words', words })}
        onStartGame={() => send({ type: 'start_game' })}
      />
    )
  }

  const isDrawer = currentRound?.drawerId === myId

  return (
    <div className="game-root">
      <GameHeader
        phase={phase}
        roundIndex={roundIndex}
        totalRounds={totalRounds}
        currentRound={currentRound}
        isDrawer={isDrawer}
        players={players}
      />

      <div className="game-body">
        <div className="canvas-area">
          <Canvas
            ref={canvasRef}
            isDrawer={isDrawer}
            phase={phase}
            onDraw={(data) => send({ type: 'draw', data })}
            roundKey={roundIndex}
          />
        </div>

        <aside className="sidebar">
          <div className="scoreboard">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map(p => (
                <div
                  key={p.id}
                  className={[
                    'score-row',
                    p.id === myId ? 'me' : '',
                    p.id === currentRound?.drawerId ? 'drawing' : '',
                    !p.connected ? 'offline' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {p.id === currentRound?.drawerId && <span className="pencil">✏️</span>}
                  <span className="player-name">{p.name}{p.id === myId ? ' (you)' : ''}</span>
                  <span className="player-score">{p.score}</span>
                </div>
              ))}
          </div>

          <Chat
            messages={messages}
            onGuess={(text) => send({ type: 'guess', text })}
            isDrawer={isDrawer}
            phase={phase}
          />
        </aside>
      </div>

      {phase === 'round_end' && currentRound && (
        <div className="overlay">
          <div className="overlay-card">
            <p className="overlay-label">The word was</p>
            <p className="overlay-word">{currentRound.word}</p>
            <p className="overlay-sub">Next round starting…</p>
          </div>
        </div>
      )}

      {phase === 'game_end' && (
        <div className="overlay">
          <div className="overlay-card wide">
            <h2>Game Over!</h2>
            <div className="final-scores">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div key={p.id} className={`final-row ${i === 0 ? 'winner' : ''}`}>
                    <span className="rank">{i === 0 ? '🏆' : `${i + 1}.`}</span>
                    <span>{p.name}</span>
                    <span>{p.score} pts</span>
                  </div>
                ))}
            </div>
            <button className="btn-primary" onClick={() => send({ type: 'reset' })}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function JoinForm({ onJoin, playerCount }) {
  const [name, setName] = useState('')
  const submit = () => { if (name.trim()) onJoin(name.trim()) }

  return (
    <div className="center-screen">
      <div className="join-card">
        <h1 className="game-title">Skribble</h1>
        <p className="join-sub">{playerCount} player{playerCount !== 1 ? 's' : ''} in the room</p>
        <input
          className="text-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Your name"
          maxLength={20}
          autoFocus
        />
        <button className="btn-primary" onClick={submit} disabled={!name.trim()}>
          Join Game
        </button>
      </div>
    </div>
  )
}
