// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  avatar?: string
  branch?: number
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  roles: Role[]
}

export interface Role {
  id: number
  name: string
  description: string
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export type CustomerType = 'NATURAL' | 'JURIDICA'
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Customer {
  id: string
  customer_code: string
  customer_type: CustomerType
  full_name: string
  first_name: string
  second_name: string
  last_name: string
  second_last_name: string
  company_name: string
  company_type: string
  id_type: string
  id_number: string
  id_expiry_date?: string
  nationality: string
  date_of_birth?: string
  gender: 'M' | 'F' | ''
  gender_display?: string
  marital_status: string
  marital_status_display?: string
  photo?: string
  phone1: string
  phone2: string
  email: string
  whatsapp: string
  address: string
  address_reference: string
  sector: string
  municipality: string
  city: string
  province: string
  country: string
  latitude?: number
  longitude?: number
  occupation: string
  employer: string
  employer_phone: string
  employer_address: string
  employment_years?: number
  monthly_income?: number
  other_income: number
  monthly_expenses: number
  payment_capacity: number
  status: CustomerStatus
  status_display: string
  risk_level: RiskLevel
  risk_level_display: string
  credit_score?: number
  is_blacklisted: boolean
  blacklist_reason: string
  active_loans_count: number
  total_loans_count: number
  outstanding_balance: number
  total_paid: number
  branch: number
  notes: string
  created_at: string
  updated_at: string
  references?: CustomerReference[]
  commercial_references?: CustomerCommercialReference[]
  bank_references?: CustomerBankReference[]
  documents?: CustomerDocument[]
  guarantors?: CustomerGuarantor[]
  financial_summary?: CustomerFinancialSummary
  employment?: CustomerEmployment
  business?: CustomerBusiness
  financial_info?: CustomerFinancialInfo
  latest_evaluation?: CustomerCreditEvaluation
}

export interface CustomerEmployment {
  id?: number
  company: string
  position: string
  start_date?: string
  salary?: number
  contract_type: string
  company_phone: string
  company_address: string
  supervisor_name: string
  supervisor_phone: string
}

export interface CustomerBusiness {
  id?: number
  business_name: string
  activity_type: string
  years_operating?: number
  monthly_income?: number
  monthly_expenses?: number
  address: string
  rnc: string
}

export interface CustomerFinancialInfo {
  id?: number
  salary_income: number
  commission_income: number
  business_income: number
  other_income: number
  housing_expenses: number
  food_expenses: number
  transport_expenses: number
  services_expenses: number
  education_expenses: number
  active_loans_debt: number
  credit_card_debt: number
  monthly_installments: number
  total_income: number
  total_expenses: number
  payment_capacity: number
}

export interface CustomerReference {
  id?: number
  customer?: string
  name: string
  phone: string
  relationship: string
  relationship_display?: string
  address: string
  occupation: string
}

export interface CustomerCommercialReference {
  id?: number
  customer?: string
  company: string
  contact_name: string
  phone: string
  relationship_years?: number
}

export interface CustomerBankReference {
  id?: number
  customer?: string
  bank_name: string
  account_type: string
  account_type_display?: string
  account_number: string
}

export interface CustomerGuarantor {
  id?: number
  customer?: string
  name: string
  id_number: string
  phone: string
  address: string
  occupation: string
  employer: string
  monthly_income?: number
  notes: string
}

export interface CustomerDocument {
  id?: number
  customer?: string
  document_type: string
  document_type_display?: string
  file?: string
  file_name: string
  file_size: number
  mime_type: string
  is_verified: boolean
  expiry_date?: string
  notes: string
  uploaded_at?: string
}

export interface CustomerFinancialSummary {
  total_disbursed: number
  total_paid: number
  outstanding_principal: number
  outstanding_interest: number
  outstanding_late_fees: number
  active_loans: number
  completed_loans: number
  defaulted_loans: number
  payment_on_time_rate: number
  max_days_past_due: number
  total_late_count: number
  next_payment_date?: string
  next_payment_amount?: number
}

export interface CustomerActivity {
  id?: number
  customer?: string
  activity_type: string
  activity_type_display?: string
  date: string
  result: string
  result_display?: string
  notes: string
  created_by_name?: string
  created_at?: string
}

export interface CustomerCreditEvaluation {
  id?: number
  score: number
  rating: string
  rating_display?: string
  recommended_max_amount?: number
  risk_factors: string[]
  ai_summary: string
  evaluated_at?: string
}

// ─── Loan Application ────────────────────────────────────────────────────────
export type ApplicationStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW'
  | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'DISBURSED'

export interface LoanApplication {
  id: string
  application_number: string
  customer: string
  customer_name: string
  customer_code: string
  customer_id_number: string
  customer_phone: string
  customer_risk: string
  customer_credit_score?: number
  customer_income?: number
  product: number
  product_name: string
  product_code: string
  product_rate?: number
  product_type?: string
  branch: number
  branch_name: string
  requested_amount: number
  requested_term_months: number
  purpose: string
  status: ApplicationStatus
  status_display: string
  current_step: number
  assigned_to?: string
  assigned_to_name?: string
  monthly_payment_estimate?: number
  debt_to_income_ratio?: number
  credit_score_at_application?: number
  risk_level: string
  approved_amount?: number
  approved_term_months?: number
  approved_rate?: number
  submitted_at?: string
  approved_at?: string
  rejected_at?: string
  disbursed_at?: string
  rejection_reason?: string
  rejected_by_name?: string
  notes?: string
  workflow_logs?: ApplicationWorkflowLog[]
  documents?: ApplicationDocument[]
  created_at: string
}

export interface ApplicationWorkflowLog {
  id: number
  step: number
  action: string
  action_display: string
  performed_by_name: string
  comments: string
  created_at: string
}

export interface ApplicationDocument {
  id?: number
  document_type: string
  document_name: string
  is_required: boolean
  is_verified: boolean
  uploaded_at?: string
}

export interface ApplicationStats {
  total: number
  draft: number
  submitted: number
  under_review: number
  approved: number
  rejected: number
  disbursed: number
  total_requested?: number
  total_approved?: number
}

export interface LoanProduct {
  id: number
  name: string
  code: string
  product_type: string
  product_type_display: string
  annual_interest_rate: number
  min_amount: number
  max_amount: number
  min_term_months: number
  max_term_months: number
  requires_guarantee: boolean
  requires_guarantor: boolean
  is_active: boolean
  approval_levels: number
}

// ─── Loan ─────────────────────────────────────────────────────────────────────
export type LoanStatus = 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'WRITTEN_OFF' | 'CANCELLED' | 'REFINANCED'

export interface Loan {
  id: string
  loan_number: string
  customer: string | Customer
  customer_data?: Customer
  customer_name?: string
  customer_code?: string
  product: number
  product_name: string
  product_code?: string
  branch: number
  branch_name?: string
  officer?: string
  officer_name?: string
  principal_amount: number
  annual_interest_rate: number
  term_months: number
  payment_method: string
  payment_method_display?: string
  late_fee_rate: number
  commission_amount: number
  monthly_payment: number
  total_interest: number
  total_to_pay: number
  outstanding_principal: number
  outstanding_interest: number
  outstanding_late_fees: number
  total_outstanding?: number
  total_paid: number
  status: LoanStatus
  status_display: string
  days_past_due: number
  installments_paid: number
  installments_remaining: number
  disbursement_date: string
  first_payment_date?: string
  maturity_date: string
  last_payment_date?: string
  is_refinanced: boolean
  notes: string
  schedule?: LoanScheduleItem[]
  next_payment?: {
    installment_number: number
    due_date: string
    total_amount: number
    total_paid: number
    status: string
    is_overdue: boolean
  }
  overdue_installments?: number
  created_at: string
}

export interface LoanStats {
  total: number
  active: number
  completed: number
  defaulted: number
  written_off: number
  total_portfolio?: number
  total_disbursed?: number
  total_collected?: number
  overdue_count: number
  overdue_portfolio?: number
  avg_days_past_due?: number
  delinquency_rate: number
}

export interface LoanScheduleItem {
  id: number
  installment_number: number
  due_date: string
  principal_amount: number
  interest_amount: number
  total_amount: number
  late_fee_amount: number
  paid_principal: number
  paid_interest: number
  total_paid: number
  paid_date?: string
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED'
  balance_after: number
  is_overdue: boolean
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export interface Payment {
  id: string
  payment_number: string
  loan: string
  loan_number: string
  customer_name: string
  total_amount: number
  principal_amount: number
  interest_amount: number
  late_fee_amount: number
  payment_type: string
  payment_method: string
  receipt_number: string
  payment_date: string
  status: string
  received_by_name: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardData {
  total_portfolio: number
  active_loans_count: number
  overdue_loans_count: number
  overdue_portfolio: number
  delinquency_rate: number
  active_customers: number
  customers_in_arrears: number
  // Cobros
  collections_today: number
  collections_today_count: number
  collections_this_month: number
  collections_month_count: number
  // Intereses / ganancia
  interest_today: number
  interest_this_month: number
  // Desembolsos
  disbursements_this_month: number
  // Próximos vencimientos
  upcoming_payments: number
  // Semáforo de mora
  mora_1_15: number
  mora_16_30: number
  mora_30_plus: number
  today: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number
  total_pages: number
  current_page: number
  next: string | null
  previous: string | null
  results: T[]
}
