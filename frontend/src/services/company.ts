import api from './api'

export interface CompanySettings {
  company_name: string
  legal_name: string
  tax_id: string
  logo?: string | null
  address: string
  city: string
  province: string
  country: string
  phone: string
  phone2: string
  email: string
  website: string
  whatsapp: string
  bank_accounts: string
  currency: string
  currency_symbol: string
  timezone: string
  receipt_footer: string
  statement_footer: string
  legal_notice: string
  facebook: string
  instagram: string
  updated_at?: string
}

export interface BackupConfig {
  enabled: boolean
  frequency: string
  frequency_display: string
  time_of_day: string
  retention_days: number
  notify_emails: string
  last_run_at?: string | null
  last_status?: string
  last_error?: string
}

export interface BackupRecord {
  id: number
  file_name: string
  file_size_mb: number
  status: string
  status_display: string
  trigger: string
  trigger_display: string
  started_at: string
  completed_at?: string | null
  duration_seconds?: number | null
  error_message?: string
  triggered_by_name: string
}

export const companyService = {
  get: () => api.get<CompanySettings>('/dashboard/company/'),
  update: (data: Partial<CompanySettings>) => api.patch<CompanySettings>('/dashboard/company/', data),
  uploadLogo: (file: File) => {
    const fd = new FormData()
    fd.append('logo', file)
    return api.patch<CompanySettings>('/dashboard/company/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const backupService = {
  getConfig:    () => api.get<BackupConfig>('/dashboard/backup/config/'),
  updateConfig: (data: Partial<BackupConfig>) => api.patch<BackupConfig>('/dashboard/backup/config/', data),
  list:         () => api.get<{ count: number; results: BackupRecord[] }>('/dashboard/backup/list/'),
  runNow:       () => api.post<{ success: boolean; message: string; record: BackupRecord }>('/dashboard/backup/run/', {}),

  /** Descarga un backup directamente como blob */
  downloadUrl: (id: number) => `/api/v1/dashboard/backup/${id}/download/`,

  /** Restaura la DB desde un archivo .sqlite3 subido */
  restore: (file: File) => {
    const fd = new FormData()
    fd.append('backup_file', file)
    return api.post<{ success: boolean; message: string; tables_found: number; emergency_backup: string }>(
      '/dashboard/backup/restore/', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}

export interface EarningsPeriod {
  date: string; label: string
  interest: number; principal: number; total: number; count: number
}

export interface EarningsSummary {
  today_interest: number; today_principal: number; today_total: number
  week_interest: number; week_total: number
  month_interest: number; month_total: number
  year_interest: number; year_total: number
}

export interface EarningsData {
  summary: EarningsSummary
  daily: EarningsPeriod[]
  weekly: EarningsPeriod[]
  monthly: EarningsPeriod[]
}

export const earningsService = {
  get: () => api.get<EarningsData>('/dashboard/earnings/'),
}

export interface ShareDocument {
  wa_url: string | null
  wa_phone: string
  message: string
  customer_name: string
  loan_number?: string
  schedule_count?: number
  total_paid?: number
  total_outstanding?: number
  payments_count?: number
}

export interface RecurrenceAnalysis {
  has_data: boolean
  loan_number?: string
  classification: 'EXCELLENT' | 'REGULAR' | 'IRREGULAR' | 'POOR' | 'NEW'
  classification_label: string
  score: number
  on_time: number
  late: number
  very_late: number
  unpaid: number
  total_paid_installments: number
  on_time_rate: number
  avg_days_late: number
  payments_count: number
  avg_payment_interval_days: number
  recent_payments_3m: number
  older_payments: number
  recent_amount_3m: number
  monthly_payment: number
  last_payment_date?: string | null
}

export const documentsService = {
  shareAmortization: (loanId: string) =>
    api.get<ShareDocument>(`/dashboard/amortization/${loanId}/whatsapp/`),
  shareStatement: (loanId: string) =>
    api.get<ShareDocument>(`/dashboard/statement/${loanId}/whatsapp/`),
  getRecurrence: (loanId: string) =>
    api.get<RecurrenceAnalysis>(`/dashboard/analysis/${loanId}/recurrence/`),
}
