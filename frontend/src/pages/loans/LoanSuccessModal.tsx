import { CheckCircle, FileText, Table2, MessageCircle, X, Loader2 } from 'lucide-react'
import api from '@/services/api'
import { saveBlob } from '@/utils/download'
import toast from 'react-hot-toast'
import { useState } from 'react'

interface LoanSummary {
  id: string
  loan_number: string
  customer_name: string
  customer_phone?: string
  principal_amount: number
  monthly_payment: number
  total_to_pay: number
  total_interest: number
  payment_frequency_display?: string
  maturity_date: string
  disbursement_date: string
}

interface Props {
  loan: LoanSummary
  onClose: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

function PdfButton({ endpoint, label, icon: Icon, color }: {
  endpoint: string; label: string; icon: typeof FileText; color: string
}) {
  const [loading, setLoading] = useState(false)
  const download = async () => {
    setLoading(true)
    try {
      const path = endpoint.replace(/^\/api\/v1/, '')
      const res = await api.get(path, { responseType: 'blob', timeout: 120_000 })
      const disp = (res.headers['content-disposition'] as string) || ''
      const match = disp.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || 'documento.pdf'
      const saved = await saveBlob(res.data as Blob, filename)
      if (saved) toast.success(`Archivo: ${filename}`)
    } catch { toast.error('Error descargando PDF') }
    finally { setLoading(false) }
  }
  return (
    <button onClick={download} disabled={loading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all hover:shadow-sm ${color}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {loading ? 'Generando...' : label}
    </button>
  )
}

export default function LoanSuccessModal({ loan, onClose }: Props) {
  const waMessage = [
    `Estimado/a ${loan.customer_name},`,
    `Su préstamo ha sido aprobado y desembolsado:`,
    ``,
    `Préstamo: ${loan.loan_number}`,
    `Monto: ${fmt(loan.principal_amount)}`,
    `Cuota: ${fmt(loan.monthly_payment)}`,
    `Total a pagar: ${fmt(loan.total_to_pay)}`,
    `Vencimiento: ${loan.maturity_date}`,
    ``,
    `¡Gracias por su confianza!`,
  ].join('\n')

  const waUrl = loan.customer_phone
    ? `https://wa.me/${formatPhone(loan.customer_phone)}?text=${encodeURIComponent(waMessage)}`
    : ''

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-center text-white relative">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="h-5 w-5" />
          </button>
          <CheckCircle className="h-14 w-14 mx-auto mb-3 drop-shadow-md" />
          <h2 className="text-xl font-bold">Préstamo Registrado</h2>
          <p className="text-emerald-100 text-sm mt-1">{loan.loan_number}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Cliente</p>
              <p className="font-semibold text-gray-900 truncate">{loan.customer_name}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Capital</p>
              <p className="font-semibold text-gray-900">{fmt(loan.principal_amount)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Cuota</p>
              <p className="font-semibold text-primary-700">{fmt(loan.monthly_payment)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Ganancia</p>
              <p className="font-semibold text-emerald-600">{fmt(loan.total_interest)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documentos</p>
            <div className="grid grid-cols-1 gap-2">
              <PdfButton
                endpoint={`/api/v1/reports/pdf/contract/${loan.id}/`}
                label="Descargar Contrato"
                icon={FileText}
                color="border-blue-200 text-blue-700 hover:bg-blue-50"
              />
              <PdfButton
                endpoint={`/api/v1/reports/pdf/amortization/${loan.id}/`}
                label="Tabla de Amortización"
                icon={Table2}
                color="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              />
            </div>
          </div>

          {waUrl && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notificar al cliente</p>
              <button
                onClick={() => window.open(waUrl, '_blank', 'noopener,noreferrer')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Enviar detalles por WhatsApp
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100">
          <button onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits
  if (digits.length === 10) return '1' + digits
  if (digits.length === 7) return '1809' + digits
  return digits
}
