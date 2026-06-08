import api from './api'
import type { DashboardData } from '@/types'

export const dashboardService = {
  getData: () => api.get<DashboardData>('/dashboard/'),
  getCharts: () => api.get('/dashboard/charts/'),
  getAlerts: () => api.get('/dashboard/alerts/'),
}
