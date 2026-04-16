import { useState } from 'react'

export default function Lobby({ players, myPlayer, onSubmitWords, onStartGame }) {
  const [words, setWords] = useState(['', '', ''])

  const connectedPlayers = players.filter(p => p.connected)
  const readyCount = connectedPlayers.filter(p => p.wordsSubmitted).length
  const canStart = readyCount >= 2 && myPlayer.wordsSubmitted

  const allFilled = words.every(w => w.trim())

  const submit = () => {
    if (allFilled) onSubmitWords(words.map(w => w.trim()))
  }

  return (
    <div className="lobby-root">
      <div className="lobby-container">
        <h1 className="game-title">Skribble</h1>

        <div className="lobby-panels">
          {/* Players panel */}
          <div className="lobby-panel">
            <h3>Players ({connectedPlayers.length})</h3>
            <div className="lobby-player-list">
              {connectedPlayers.map(p => (
                <div key={p.id} className={`lobby-player ${p.wordsSubmitted ? 'ready' : ''}`}>
                  <span>{p.name}{p.id === myPlayer.id ? ' (you)' : ''}</span>
                  <span className="ready-badge">{p.wordsSubmitted ? '✓ Ready' : '…'}</span>
                </div>
              ))}
            </div>
            <p className="ready-count">{readyCount}/{connectedPlayers.length} ready</p>
          </div>

          {/* Word submission panel */}
          <div className="lobby-panel">
            {!myPlayer.wordsSubmitted ? (
              <>
                <h3>Submit 3 words to draw</h3>
                <p className="lobby-hint">
                  These words go into the pool — any player might draw them!
                </p>
                <div className="word-inputs">
                  {words.map((w, i) => (
                    <input
                      key={i}
                      className="text-input"
                      value={w}
                      onChange={e => setWords(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                      onKeyDown={e => e.key === 'Enter' && i < 2 && document.querySelectorAll('.word-inputs input')[i + 1]?.focus()}
                      placeholder={`Word ${i + 1} (e.g. ${['elephant', 'guitar', 'volcano'][i]})`}
                      maxLength={30}
                    />
                  ))}
                </div>
                <button className="btn-primary" onClick={submit} disabled={!allFilled}>
                  Submit Words
                </button>
              </>
            ) : (
              <div className="waiting-area">
                <div className="checkmark">✓</div>
                <p>Words submitted!</p>
                <p className="lobby-hint">Waiting for others to submit their words…</p>
                {canStart && (
                  <>
                    <p className="start-hint">Everyone's ready!</p>
                    <button className="btn-start" onClick={onStartGame}>
                      Start Game
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
