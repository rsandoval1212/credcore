import api from './api'
import type {
  Customer, CustomerActivity, CustomerCreditEvaluation,
  CustomerReference, CustomerCommercialReference, CustomerBankReference,
  CustomerGuarantor, CustomerEmployment, CustomerBusiness, CustomerFinancialInfo,
  PaginatedResponse,
} from '@/types'

export const customersService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Customer>>('/customers/', { params }),

  get: (id: string) =>
    api.get<Customer>(`/customers/${id}/`),

  create: (data: Partial<Customer>) =>
    api.post<Customer>('/customers/', data),

  update: (id: string, data: Partial<Customer>) =>
    api.patch<Customer>(`/customers/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/customers/${id}/`),

  uploadPhoto: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('photo', file)
    return api.patch<Customer>(`/customers/${id}/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getLoanHistory: (id: string) =>
    api.get(`/customers/${id}/loan_history/`),

  getPaymentHistory: (id: string) =>
    api.get(`/customers/${id}/payment_history/`),

  uploadDocument: (id: string, formData: FormData) =>
    api.post(`/customers/${id}/upload_document/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  verifyDocument: (id: string, docId: number) =>
    api.patch(`/customers/${id}/documents/${docId}/verify/`, {}),

  getActivities: (id: string) =>
    api.get<CustomerActivity[]>(`/customers/${id}/activities/`),

  addActivity: (id: string, data: Partial<CustomerActivity>) =>
    api.post<CustomerActivity>(`/customers/${id}/activities/`, data),

  getCreditEvaluations: (id: string) =>
    api.get<CustomerCreditEvaluation[]>(`/customers/${id}/credit_evaluation/`),

  runCreditEvaluation: (id: string) =>
    api.post<CustomerCreditEvaluation>(`/customers/${id}/credit_evaluation/`, {}),

  getEmployment: (id: string) =>
    api.get<CustomerEmployment>(`/customers/${id}/employment/`),

  saveEmployment: (id: string, data: Partial<CustomerEmployment>) =>
    api.patch<CustomerEmployment>(`/customers/${id}/employment/`, data),

  getBusiness: (id: string) =>
    api.get<CustomerBusiness>(`/customers/${id}/business/`),

  saveBusiness: (id: string, data: Partial<CustomerBusiness>) =>
    api.patch<CustomerBusiness>(`/customers/${id}/business/`, data),

  getFinancialInfo: (id: string) =>
    api.get<CustomerFinancialInfo>(`/customers/${id}/financial-info/`),

  saveFinancialInfo: (id: string, data: Partial<CustomerFinancialInfo>) =>
    api.patch<CustomerFinancialInfo>(`/customers/${id}/financial-info/`, data),

  getReferences: (id: string) =>
    api.get<CustomerReference[]>(`/customers/${id}/references-personal/`),

  addReference: (id: string, data: Partial<CustomerReference>) =>
    api.post<CustomerReference>(`/customers/${id}/references-personal/`, data),

  getCommercialRefs: (id: string) =>
    api.get<CustomerCommercialReference[]>(`/customers/${id}/references-commercial/`),

  addCommercialRef: (id: string, data: Partial<CustomerCommercialReference>) =>
    api.post<CustomerCommercialReference>(`/customers/${id}/references-commercial/`, data),

  getBankRefs: (id: string) =>
    api.get<CustomerBankReference[]>(`/customers/${id}/references-bank/`),

  addBankRef: (id: string, data: Partial<CustomerBankReference>) =>
    api.post<CustomerBankReference>(`/customers/${id}/references-bank/`, data),

  getGuarantors: (id: string) =>
    api.get<CustomerGuarantor[]>(`/customers/${id}/guarantors/`),

  addGuarantor: (id: string, data: Partial<CustomerGuarantor>) =>
    api.post<CustomerGuarantor>(`/customers/${id}/guarantors/`, data),
}
