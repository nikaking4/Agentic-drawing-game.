import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'

const PORT = 3001
const ROUND_DURATION_MS = 80_000
const ROUND_END_PAUSE_MS = 5_000
const GAME_END_RESET_MS = 30_000

const server = http.createServer()
const wss = new WebSocketServer({ server })

let nextId = 1

let state = createInitialState()

function createInitialState() {
  return {
    phase: 'lobby',       // lobby | drawing | round_end | game_end
    players: {},          // id -> { id, name, score, wordsSubmitted, connected }
    wordPool: [],
    currentRound: null,   // { drawerId, word, wordLength, startTime, correctGuessers, correctGuessCount, timer }
    roundHistory: [],     // drawerId per round
    roundIndex: 0,
    totalRounds: 0,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendTo(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data))
}

function broadcast(data, excludeId = null) {
  const msg = JSON.stringify(data)
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN && ws.playerId !== excludeId) {
      ws.send(msg)
    }
  }
}

function broadcastState() {
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      sendTo(ws, { type: 'state', state: getPublicState(ws.playerId) })
    }
  }
}

function getPublicState(forPlayerId) {
  const r = state.currentRound
  let currentRound = null

  if (r) {
    const revealWord = forPlayerId === r.drawerId || state.phase === 'round_end' || state.phase === 'game_end'
    currentRound = {
      drawerId: r.drawerId,
      word: revealWord ? r.word : null,
      wordLength: r.word.length,
      startTime: r.startTime,
      correctGuessers: r.correctGuessers,
      correctGuessCount: r.correctGuessCount,
    }
  }

  return {
    phase: state.phase,
    players: Object.values(state.players),
    currentRound,
    roundIndex: state.roundIndex,
    totalRounds: state.totalRounds,
  }
}

function connectedPlayers() {
  return Object.values(state.players).filter(p => p.connected)
}

// ─── Game flow ────────────────────────────────────────────────────────────────

function startNextRound() {
  const drawn = new Set(state.roundHistory)
  const eligible = connectedPlayers().filter(p => !drawn.has(p.id))

  if (eligible.length === 0 || state.roundIndex >= state.totalRounds) {
    state.phase = 'game_end'
    broadcastState()
    setTimeout(resetGame, GAME_END_RESET_MS)
    return
  }

  const drawer = eligible[0]
  const word = state.wordPool[Math.floor(Math.random() * state.wordPool.length)]

  state.currentRound = {
    drawerId: drawer.id,
    word,
    wordLength: word.length,
    startTime: Date.now(),
    correctGuessers: [],
    correctGuessCount: 0,
    timer: setTimeout(() => endRound('timeout'), ROUND_DURATION_MS),
  }
  state.roundHistory.push(drawer.id)
  state.phase = 'drawing'
  state.roundIndex++

  broadcastState()
  broadcast({ type: 'chat', system: true, text: `${drawer.name} is drawing!` })
}

function endRound(reason) {
  if (!state.currentRound) return
  clearTimeout(state.currentRound.timer)

  // Drawer earns points if at least one person guessed
  if (state.currentRound.correctGuessCount > 0) {
    const drawer = state.players[state.currentRound.drawerId]
    if (drawer) drawer.score += 50
  }

  state.phase = 'round_end'
  broadcastState()
  broadcast({
    type: 'chat',
    system: true,
    text: reason === 'timeout'
      ? `Time's up! The word was "${state.currentRound.word}"`
      : `Round over! The word was "${state.currentRound.word}"`,
  })

  setTimeout(startNextRound, ROUND_END_PAUSE_MS)
}

function resetGame() {
  state = createInitialState()
  broadcastState()
}

// ─── Connection handling ──────────────────────────────────────────────────────

wss.on('connection', (ws) => {
  const id = String(nextId++)
  ws.playerId = id

  sendTo(ws, { type: 'welcome', id })
  sendTo(ws, { type: 'state', state: getPublicState(id) })

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    switch (msg.type) {
      case 'join': {
        const name = String(msg.name || '').trim().slice(0, 20)
        if (!name) return
        state.players[id] = { id, name, score: 0, wordsSubmitted: false, connected: true }
        broadcastState()
        break
      }

      case 'submit_words': {
        if (state.phase !== 'lobby') return
        const player = state.players[id]
        if (!player || player.wordsSubmitted) return
        const words = (msg.words || [])
          .map(w => String(w).trim().toLowerCase())
          .filter(w => w.length > 0)
          .slice(0, 3)
        if (words.length !== 3) return
        player.wordsSubmitted = true
        state.wordPool.push(...words)
        broadcastState()
        break
      }

      case 'start_game': {
        if (state.phase !== 'lobby') return
        const ready = connectedPlayers().filter(p => p.wordsSubmitted)
        if (ready.length < 2) return
        state.totalRounds = connectedPlayers().length
        startNextRound()
        break
      }

      case 'draw': {
        if (state.phase !== 'drawing') return
        if (state.currentRound?.drawerId !== id) return
        broadcast({ type: 'draw', data: msg.data }, id)
        break
      }

      case 'guess': {
        if (state.phase !== 'drawing') return
        if (state.currentRound?.drawerId === id) return
        const player = state.players[id]
        if (!player) return

        const text = String(msg.text || '').trim()
        if (!text) return
        const isCorrect = text.toLowerCase() === state.currentRound.word

        if (isCorrect && state.currentRound.correctGuessers.includes(id)) return

        if (isCorrect) {
          state.currentRound.correctGuessers.push(id)
          state.currentRound.correctGuessCount++
          const elapsed = (Date.now() - state.currentRound.startTime) / 1000
          const pts = Math.max(10, 100 - Math.floor(elapsed / 2))
          player.score += pts

          broadcast({ type: 'chat', playerId: id, name: player.name, text: `guessed the word!`, correct: true })
          broadcast({ type: 'correct_guess', playerId: id, name: player.name, pts })

          // Update scores in state
          broadcastState()

          // End round if all non-drawers guessed
          const nonDrawers = connectedPlayers().filter(p => p.id !== state.currentRound.drawerId)
          if (state.currentRound.correctGuessers.length >= nonDrawers.length) {
            endRound('all_guessed')
          }
        } else {
          broadcast({ type: 'chat', playerId: id, name: player.name, text })
        }
        break
      }

      case 'reset': {
        resetGame()
        break
      }
    }
  })

  ws.on('close', () => {
    const player = state.players[id]
    if (!player) return
    player.connected = false
    broadcastState()
    if (state.phase === 'drawing' && state.currentRound?.drawerId === id) {
      endRound('drawer_left')
    }
  })
})

server.listen(PORT, () => {
  console.log(`Game server on ws://localhost:${PORT}`)
})
