import { useState, useEffect } from 'react'

const ROUND_DURATION = 80

export default function GameHeader({ phase, roundIndex, totalRounds, currentRound, isDrawer, players }) {
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION)

  useEffect(() => {
    if (phase !== 'drawing' || !currentRound?.startTime) return
    const tick = () => {
      const elapsed = (Date.now() - currentRound.startTime) / 1000
      setTimeLeft(Math.max(0, Math.ceil(ROUND_DURATION - elapsed)))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [phase, currentRound?.startTime])

  const drawer = players?.find(p => p.id === currentRound?.drawerId)

  const wordHint = () => {
    if (!currentRound) return ''
    if (isDrawer && currentRound.word) return currentRound.word
    return Array.from({ length: currentRound.wordLength }, () => '＿').join(' ')
  }

  const urgent = timeLeft <= 10

  return (
    <header className="game-header">
      <div className="header-left">
        <span className="round-badge">Round {roundIndex}/{totalRounds}</span>
        {drawer && (
          <span className="drawer-badge">
            ✏️ {drawer.name} {isDrawer ? '(you)' : 'is drawing'}
          </span>
        )}
      </div>

      <div className="header-center">
        {phase === 'drawing' && (
          <span className={`word-display ${isDrawer ? 'is-drawer' : 'is-guesser'}`}>
            {wordHint()}
          </span>
        )}
        {phase === 'round_end' && (
          <span className="word-display revealed">
            {currentRound?.word}
          </span>
        )}
      </div>

      <div className="header-right">
        {phase === 'drawing' && (
          <span className={`timer ${urgent ? 'urgent' : ''}`}>{timeLeft}s</span>
        )}
      </div>
    </header>
  )
}
