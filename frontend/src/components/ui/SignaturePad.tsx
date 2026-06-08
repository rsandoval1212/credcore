/**
 * SignaturePad — Componente de firma digital con canvas táctil.
 * Funciona en desktop (ratón) y móvil (touch).
 */
import { useRef, useState, useEffect } from 'react'
import { Eraser, Check, X } from 'lucide-react'

interface Props {
  onSave: (signatureBase64: string) => void
  onCancel: () => void
}

export default function SignaturePad({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn]   = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#1E3A5F'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'

    // Fondo blanco
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Línea guía
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth   = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 30)
    ctx.lineTo(rect.width - 20, rect.height - 30)
    ctx.stroke()
    ctx.setLineDash([])

    // Reset stroke style
    ctx.strokeStyle = '#1E3A5F'
    ctx.lineWidth   = 2.5
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const endDraw = () => setIsDrawing(false)

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, rect.width, rect.height)
    // Redraw guide line
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 30)
    ctx.lineTo(rect.width - 20, rect.height - 30)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = '#1E3A5F'
    ctx.lineWidth = 2.5
    setHasDrawn(false)
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    const data = canvas.toDataURL('image/png')
    onSave(data)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">Firma Digital del Cliente</h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-xs text-gray-500 mb-2">Firme dentro del recuadro con el dedo o ratón:</p>
          <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full h-48 cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={!hasDrawn}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-40 transition-colors">
              <Check className="h-4 w-4" /> Guardar Firma
            </button>
            <button onClick={clear}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              <Eraser className="h-4 w-4" /> Limpiar
            </button>
            <button onClick={onCancel}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
