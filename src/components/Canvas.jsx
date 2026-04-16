import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react'

const COLORS = [
  '#1a1a1a', '#ffffff', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#a16207', '#6b7280',
]
const SIZES = [3, 8, 16, 28]
const W = 800
const H = 560

const Canvas = forwardRef(function Canvas({ isDrawer, phase, onDraw, roundKey }, ref) {
  const canvasRef = useRef(null)
  const [color, setColor] = useState('#1a1a1a')
  const [size, setSize] = useState(8)
  const drawing = useRef(false)
  const ctxRef = useRef(null)
  const pendingPath = useRef(null) // {color, size} for current stroke

  // Expose draw-event handler to parent
  useImperativeHandle(ref, () => ({
    handleDrawEvent(data) {
      applyEvent(ctxRef.current, data)
    },
  }))

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctxRef.current = ctx
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }, [roundKey])

  function applyEvent(ctx, data) {
    if (!ctx) return
    const x = data.x * W
    const y = data.y * H

    if (data.action === 'start') {
      ctx.beginPath()
      ctx.strokeStyle = data.color
      ctx.lineWidth = data.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(x, y)
    } else if (data.action === 'move') {
      ctx.lineTo(x, y)
      ctx.stroke()
    } else if (data.action === 'end') {
      ctx.closePath()
    } else if (data.action === 'clear') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
    }
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: ((clientX - rect.left) / rect.width),
      y: ((clientY - rect.top) / rect.height),
    }
  }

  function emitAndApply(data) {
    applyEvent(ctxRef.current, data)
    onDraw(data)
  }

  const onMouseDown = (e) => {
    if (!isDrawer || phase !== 'drawing') return
    e.preventDefault()
    drawing.current = true
    const pos = getPos(e)
    emitAndApply({ action: 'start', ...pos, color, size })
  }

  const onMouseMove = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    emitAndApply({ action: 'move', ...getPos(e) })
  }

  const onMouseUp = (e) => {
    if (!drawing.current) return
    drawing.current = false
    emitAndApply({ action: 'end' })
  }

  const clearCanvas = () => {
    emitAndApply({ action: 'clear' })
  }

  const canDraw = isDrawer && phase === 'drawing'

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className={`draw-canvas ${canDraw ? 'can-draw' : ''}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onMouseDown}
        onTouchMove={onMouseMove}
        onTouchEnd={onMouseUp}
      />
      {canDraw && (
        <div className="toolbar">
          <div className="color-grid">
            {COLORS.map(c => (
              <button
                key={c}
                className={`color-btn ${color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
          <div className="size-row">
            {SIZES.map(s => (
              <button
                key={s}
                className={`size-btn ${size === s ? 'active' : ''}`}
                onClick={() => setSize(s)}
              >
                <div className="size-dot" style={{ width: Math.min(s, 24), height: Math.min(s, 24) }} />
              </button>
            ))}
          </div>
          <button className="clear-btn" onClick={clearCanvas}>🗑 Clear</button>
        </div>
      )}
    </div>
  )
})

export default Canvas
