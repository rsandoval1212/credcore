import api from './api'

export interface Alert {
  id: string
  type: 'overdue' | 'upcoming'
  loan_number: string
  loan_id: string
  installment_number: number
  due_date: string
  balance_due: number
  total_amount: number
  days_overdue: number
  days_until: number
  customer_name: string
  customer_code: string
  customer_id: string
  customer_phone: string
  customer_whatsapp: string
  wa_phone: string
  wa_url_reminder: string | null
}

export interface AlertsSummary {
  upcoming_payments: number
  overdue_installments: number
  total: number
}

export interface ReceiptWhatsApp {
  wa_url: string
  wa_phone: string
  message: string
  customer_name: string
  receipt_number: string
}

export const notificationsService = {
  getAlertsSummary: (days = 7) =>
    api.get<AlertsSummary>(`/dashboard/alerts/?days=${days}`),

  getAlertsDetail: (type: 'all' | 'overdue' | 'upcoming' = 'all', days = 7) =>
    api.get<{ count: number; today: string; results: Alert[] }>(
      `/dashboard/alerts/detail/?type=${type}&days=${days}`
    ),

  getReceiptWhatsApp: (paymentId: string) =>
    api.get<ReceiptWhatsApp>(`/dashboard/receipt/${paymentId}/whatsapp/`),

  openWhatsApp: (url: string) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  },
}
