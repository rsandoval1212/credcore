import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, User, MapPin, Briefcase, Save } from 'lucide-react'
import { customersService } from '@/services/customers'
import type { Customer } from '@/types'
import toast from 'react-hot-toast'
import api from '@/services/api'
import { extractApiError } from '@/utils/apiError'

interface Props {
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}

const STEPS = ['Personal', 'Contacto', 'Laboral', 'Financiero']

interface Branch { id: number; name: string }

export default function CustomerFormModal({ customer, onClose, onSaved }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [form, setForm] = useState<Partial<Customer>>({
    customer_type: 'NATURAL',
    gender: 'M',
    nationality: 'Dominicano/a',
    country: 'República Dominicana',
    id_type: 'CEDULA',
    marital_status: 'SINGLE',
    other_income: 0,
    monthly_expenses: 0,
    ...customer,
  })

  useEffect(() => {
    api.get('/branches/').then(r => {
      const list = r.data.results || r.data
      setBranches(list)
      // Auto-seleccionar si solo hay una sucursal
      if (list.length === 1 && !form.branch) {
        setForm(f => ({ ...f, branch: list[0].id }))
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field: keyof Customer, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (!form.branch || Number(form.branch) === 0) { toast.error('Selecciona una sucursal'); return }
    if (!form.first_name && !form.company_name) { toast.error('Ingresa el nombre del cliente'); return }
    if (!form.id_number) { toast.error('Ingresa el número de documento'); return }
    if (!form.phone1) { toast.error('Ingresa el teléfono principal'); return }
    setSaving(true)
    try {
      if (customer?.id) {
        await customersService.update(customer.id, form)
        toast.success('Cliente actualizado')
      } else {
        await customersService.create(form)
        toast.success('Cliente registrado exitosamente')
      }
      onSaved()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error guardando cliente'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{customer ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <p className="text-sm text-gray-400">Paso {step + 1} de {STEPS.length}: {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 pt-4 gap-2">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${i === step ? 'bg-primary-600 text-white' : i < step ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}
            >{s}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {step === 0 && <StepPersonal form={form} set={set} branches={branches} />}
          {step === 1 && <StepContacto form={form} set={set} />}
          {step === 2 && <StepLaboral form={form} set={set} />}
          {step === 3 && <StepFinanciero form={form} set={set} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

function StepPersonal({ form, set, branches }: { form: Partial<Customer>; set: (f: keyof Customer, v: unknown) => void; branches: Branch[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm mb-2">
        <User className="h-4 w-4" /> Información Personal
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tipo de cliente" required>
          <select value={form.customer_type} onChange={e => set('customer_type', e.target.value)} className={inputCls}>
            <option value="NATURAL">Persona Natural</option>
            <option value="JURIDICA">Persona Jurídica</option>
          </select>
        </Field>
        <Field label="Sucursal" required>
          <select value={form.branch as number || ''} onChange={e => set('branch', Number(e.target.value))} className={inputCls}>
            <option value="">Seleccionar...</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      </div>

      {form.customer_type === 'NATURAL' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primer nombre" required><input value={form.first_name || ''} onChange={e => set('first_name', e.target.value)} className={inputCls} placeholder="Juan" /></Field>
            <Field label="Segundo nombre"><input value={form.second_name || ''} onChange={e => set('second_name', e.target.value)} className={inputCls} placeholder="Carlos" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primer apellido" required><input value={form.last_name || ''} onChange={e => set('last_name', e.target.value)} className={inputCls} placeholder="Pérez" /></Field>
            <Field label="Segundo apellido"><input value={form.second_last_name || ''} onChange={e => set('second_last_name', e.target.value)} className={inputCls} placeholder="García" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Sexo">
              <select value={form.gender || 'M'} onChange={e => set('gender', e.target.value)} className={inputCls}>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </Field>
            <Field label="Estado civil">
              <select value={form.marital_status || ''} onChange={e => set('marital_status', e.target.value)} className={inputCls}>
                <option value="">Seleccionar</option>
                <option value="SINGLE">Soltero/a</option>
                <option value="MARRIED">Casado/a</option>
                <option value="DIVORCED">Divorciado/a</option>
                <option value="WIDOWED">Viudo/a</option>
                <option value="UNION">Unión Libre</option>
              </select>
            </Field>
            <Field label="Fecha de nacimiento"><input type="date" value={form.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nacionalidad"><input value={form.nationality || ''} onChange={e => set('nationality', e.target.value)} className={inputCls} placeholder="Dominicano/a" /></Field>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre de la empresa" required><input value={form.company_name || ''} onChange={e => set('company_name', e.target.value)} className={inputCls} /></Field>
          <Field label="Tipo de empresa"><input value={form.company_type || ''} onChange={e => set('company_type', e.target.value)} className={inputCls} /></Field>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Tipo de documento" required>
          <select value={form.id_type || 'CEDULA'} onChange={e => set('id_type', e.target.value)} className={inputCls}>
            <option value="CEDULA">Cédula</option>
            <option value="PASSPORT">Pasaporte</option>
            <option value="RNC">RNC</option>
            <option value="OTHER">Otro</option>
          </select>
        </Field>
        <Field label="Número de documento" required><input value={form.id_number || ''} onChange={e => set('id_number', e.target.value)} className={inputCls} placeholder="000-0000000-0" /></Field>
        <Field label="Vencimiento del doc."><input type="date" value={form.id_expiry_date || ''} onChange={e => set('id_expiry_date', e.target.value)} className={inputCls} /></Field>
      </div>
    </div>
  )
}

function StepContacto({ form, set }: { form: Partial<Customer>; set: (f: keyof Customer, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm mb-2">
        <MapPin className="h-4 w-4" /> Contacto y Dirección
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Teléfono principal" required><input value={form.phone1 || ''} onChange={e => set('phone1', e.target.value)} className={inputCls} placeholder="809-000-0000" /></Field>
        <Field label="Teléfono secundario"><input value={form.phone2 || ''} onChange={e => set('phone2', e.target.value)} className={inputCls} placeholder="809-000-0000" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="WhatsApp"><input value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} className={inputCls} placeholder="809-000-0000" /></Field>
        <Field label="Correo electrónico"><input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="cliente@email.com" /></Field>
      </div>

      <hr className="border-gray-100" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="País"><input value={form.country || 'República Dominicana'} onChange={e => set('country', e.target.value)} className={inputCls} /></Field>
        <Field label="Provincia"><input value={form.province || ''} onChange={e => set('province', e.target.value)} className={inputCls} placeholder="Santo Domingo" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Municipio"><input value={form.municipality || ''} onChange={e => set('municipality', e.target.value)} className={inputCls} placeholder="Santo Domingo Este" /></Field>
        <Field label="Sector"><input value={form.sector || ''} onChange={e => set('sector', e.target.value)} className={inputCls} placeholder="Los Mina" /></Field>
      </div>
      <Field label="Calle / Dirección">
        <textarea value={form.address || ''} onChange={e => set('address', e.target.value)} className={`${inputCls} resize-none`} rows={2} placeholder="Calle 5 #12, Apto. 3B" />
      </Field>
      <Field label="Punto de referencia">
        <textarea value={form.address_reference || ''} onChange={e => set('address_reference', e.target.value)} className={`${inputCls} resize-none`} rows={2} placeholder="Frente al parque, esquina farmacia..." />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Latitud (GPS)"><input type="number" step="0.0000001" value={form.latitude || ''} onChange={e => set('latitude', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} placeholder="18.4861" /></Field>
        <Field label="Longitud (GPS)"><input type="number" step="0.0000001" value={form.longitude || ''} onChange={e => set('longitude', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} placeholder="-69.9312" /></Field>
      </div>
    </div>
  )
}

function StepLaboral({ form, set }: { form: Partial<Customer>; set: (f: keyof Customer, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm mb-2">
        <Briefcase className="h-4 w-4" /> Información Laboral
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ocupación"><input value={form.occupation || ''} onChange={e => set('occupation', e.target.value)} className={inputCls} placeholder="Empleado / Comerciante" /></Field>
        <Field label="Empresa / Empleador"><input value={form.employer || ''} onChange={e => set('employer', e.target.value)} className={inputCls} placeholder="Empresa XYZ" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Teléfono del empleador"><input value={form.employer_phone || ''} onChange={e => set('employer_phone', e.target.value)} className={inputCls} placeholder="809-000-0000" /></Field>
        <Field label="Años en el empleo"><input type="number" min="0" value={form.employment_years || ''} onChange={e => set('employment_years', e.target.value ? parseInt(e.target.value) : undefined)} className={inputCls} placeholder="3" /></Field>
      </div>
      <Field label="Dirección del empleador">
        <textarea value={form.employer_address || ''} onChange={e => set('employer_address', e.target.value)} className={`${inputCls} resize-none`} rows={2} />
      </Field>
    </div>
  )
}

function StepFinanciero({ form, set }: { form: Partial<Customer>; set: (f: keyof Customer, v: unknown) => void }) {
  const income = parseFloat(String(form.monthly_income || 0)) + parseFloat(String(form.other_income || 0))
  const expenses = parseFloat(String(form.monthly_expenses || 0))
  const capacity = income - expenses

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm mb-2">
        Información Financiera
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ingreso mensual (RD$)">
          <input type="number" min="0" value={form.monthly_income || ''} onChange={e => set('monthly_income', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} placeholder="25000" />
        </Field>
        <Field label="Otros ingresos (RD$)">
          <input type="number" min="0" value={form.other_income || 0} onChange={e => set('other_income', parseFloat(e.target.value) || 0)} className={inputCls} placeholder="0" />
        </Field>
      </div>
      <Field label="Gastos mensuales totales (RD$)">
        <input type="number" min="0" value={form.monthly_expenses || 0} onChange={e => set('monthly_expenses', parseFloat(e.target.value) || 0)} className={inputCls} placeholder="15000" />
      </Field>

      {income > 0 && (
        <div className={`rounded-xl p-4 text-sm font-medium ${capacity >= 0 ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
          Capacidad de pago estimada: RD${capacity.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
        </div>
      )}

      <hr className="border-gray-100" />

      <Field label="Notas internas">
        <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className={`${inputCls} resize-none`} rows={3} placeholder="Observaciones generales del cliente..." />
      </Field>
    </div>
  )
}
