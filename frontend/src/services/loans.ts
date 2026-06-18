import api from './api'
import type { Loan, LoanScheduleItem, LoanStats, PaginatedResponse } from '@/types'

export const loansService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Loan>>('/loans/', { params }),

  get: (id: string) =>
    api.get<Loan>(`/loans/${id}/`),

  update: (id: string, data: Partial<Loan>) =>
    api.patch<Loan>(`/loans/${id}/`, data),

  stats: () =>
    api.get<LoanStats>('/loans/stats/'),

  getSchedule: (id: string) =>
    api.get<LoanScheduleItem[]>(`/loans/${id}/schedule/`),

  getPayments: (id: string) =>
    api.get(`/loans/${id}/payments/`),

  simulate: (data: { product_id: number; amount: number; term_months: number; start_date?: string }) =>
    api.post('/loans/simulate/', data),

  // Préstamo directo (sin pasar por el módulo de solicitudes)
  direct: (data: {
    customer: string | number
    product: number
    amount: number
    term_months?: number
    rate?: number
    payment_frequency?: string
    total_installments?: number
    client_installments?: number
    total_to_receive?: number
    days?: number
    is_confidential?: boolean
    disbursement_date?: string
  }) => api.post<Loan>('/loans/direct/', data),

  writeOff: (id: string, reason: string) =>
    api.post(`/loans/${id}/write_off/`, { reason }),

  updateDelinquency: (id: string) =>
    api.post(`/loans/${id}/update_delinquency/`, {}),

  generateSchedule: (id: string) =>
    api.post(`/loans/${id}/generate_schedule/`, {}),
}
