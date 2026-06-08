export const formatCurrency = (amount: number, currency = 'DOP') => {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(dateStr))
}

export const formatDatetime = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr))
}

export const getLoanStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    ACTIVE: 'Activo', COMPLETED: 'Completado', DEFAULTED: 'En Mora',
    WRITTEN_OFF: 'Castigado', CANCELLED: 'Cancelado', REFINANCED: 'Refinanciado',
  }
  return labels[status] || status
}

export const getLoanStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    ACTIVE: 'badge-green', COMPLETED: 'badge-blue', DEFAULTED: 'badge-red',
    WRITTEN_OFF: 'badge-gray', CANCELLED: 'badge-gray', REFINANCED: 'badge-yellow',
  }
  return classes[status] || 'badge-gray'
}

export const getRiskClass = (risk: string) => {
  const classes: Record<string, string> = { LOW: 'badge-green', MEDIUM: 'badge-yellow', HIGH: 'badge-red' }
  return classes[risk] || 'badge-gray'
}

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    ACTIVE: 'Activo', INACTIVE: 'Inactivo', BLOCKED: 'Bloqueado',
    PENDING: 'Pendiente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado',
    PAID: 'Pagada', OVERDUE: 'Vencida', PARTIAL: 'Parcial',
  }
  return labels[status] || status
}
