import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { notificationsService } from '@/services/notifications'
import toast from 'react-hot-toast'

interface Props {
  paymentId: string
  size?: 'sm' | 'md'
  label?: string
}

export default function ReceiptWhatsAppButton({ paymentId, size = 'sm', label }: Props) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const r = await notificationsService.getReceiptWhatsApp(paymentId)
      if (!r.data.wa_phone) {
        toast.error('El cliente no tiene número de WhatsApp/teléfono registrado')
        return
      }
      notificationsService.openWhatsApp(r.data.wa_url)
      toast.success(`Recibo enviado a ${r.data.customer_name} por WhatsApp`, { icon: '📱' })
    } catch {
      toast.error('Error generando el recibo')
    } finally {
      setLoading(false)
    }
  }

  if (size === 'md') {
    return (
      <button onClick={handleClick} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 text-sm font-medium transition-colors">
        <MessageCircle className="h-4 w-4" />
        {loading ? 'Generando...' : (label || 'Enviar recibo por WhatsApp')}
      </button>
    )
  }

  return (
    <button onClick={handleClick} disabled={loading} title="Enviar recibo por WhatsApp"
      className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 disabled:opacity-50 transition-colors">
      <MessageCircle className="h-4 w-4" />
    </button>
  )
}
