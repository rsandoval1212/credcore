import api from './api'
import type { LoanApplication, ApplicationStats, LoanProduct, PaginatedResponse } from '@/types'

export const applicationsService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<LoanApplication>>('/loan-applications/', { params }),

  get: (id: string) =>
    api.get<LoanApplication>(`/loan-applications/${id}/`),

  create: (data: Partial<LoanApplication>) =>
    api.post<LoanApplication>('/loan-applications/', data),

  update: (id: string, data: Partial<LoanApplication>) =>
    api.patch<LoanApplication>(`/loan-applications/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/loan-applications/${id}/`),

  // Workflow
  submit: (id: string) =>
    api.post<LoanApplication>(`/loan-applications/${id}/submit/`, {}),

  startReview: (id: string) =>
    api.post<LoanApplication>(`/loan-applications/${id}/start_review/`, {}),

  approve: (id: string, data: { approved_amount?: number; approved_term_months?: number; approved_rate?: number; comments?: string }) =>
    api.post<LoanApplication>(`/loan-applications/${id}/approve/`, data),

  reject: (id: string, reason: string) =>
    api.post<LoanApplication>(`/loan-applications/${id}/reject/`, { reason }),

  cancel: (id: string, reason?: string) =>
    api.post<LoanApplication>(`/loan-applications/${id}/cancel/`, { reason }),

  disburse: (id: string) =>
    api.post(`/loan-applications/${id}/disburse/`, {}),

  recalculate: (id: string) =>
    api.post<LoanApplication>(`/loan-applications/${id}/recalculate/`, {}),

  uploadDocument: (id: string, data: FormData) =>
    api.post(`/loan-applications/${id}/upload_document/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  stats: () =>
    api.get<ApplicationStats>('/loan-applications/stats/'),
}

export const productsService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<LoanProduct>>('/loan-products/', { params }),

  get: (id: number) =>
    api.get<LoanProduct>(`/loan-products/${id}/`),
}
