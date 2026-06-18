import { useState, useEffect, useRef } from 'react'
import { X, Search, Shield, Car, Home, Wrench, Upload } from 'lucide-react'
import { customersService } from '@/services/customers'
import type { Customer } from '@/types'
import toast from 'react-hot-toast'
import api from '@/services/api'
import { extractApiError } from '@/utils/apiError'

interface Props {
  onClose: () => void
  onSaved: () => void
}

type GuaranteeType = 'VEHICLE' | 'REAL_ESTATE' | 'EQUIPMENT' | 'OTHER'

const TYPE_OPTIONS: { key: GuaranteeType; label: string; icon: typeof Car }[] = [
  { key: 'VEHICLE', label: 'Vehículo', icon: Car },
  { key: 'REAL_ESTATE', label: 'Inmueble', icon: Home },
  { key: 'EQUIPMENT', label: 'Equipo', icon: Wrench },
  { key: 'OTHER', label: 'Otro', icon: Shield },
]

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

interface LoanOption { id: string; loan_number: string; principal_amount: number; status: string }

export default function GuaranteeFormModal({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerLoans, setCustomerLoans] = useState<LoanOption[]>([])
  const [selectedLoan, setSelectedLoan] = useState<string>('')
  const [gType, setGType] = useState<GuaranteeType>('VEHICLE')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    description: '',
    estimated_value: '',
    appraiser: '',
    notes: '',
    // Vehicle
    make: '', model: '', year: '', color: '', plate_number: '', chassis_number: '',
    // Real estate
    property_type: 'HOUSE', address: '', city: '', province: '', area_m2: '', title_number: '',
  })

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return }
    const t = setTimeout(() => {
      customersService.list({ search: customerSearch, page_size: 8 })
        .then(r => setCustomers(r.data.results))
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [customerSearch])

  useEffect(() => {
    if (!selectedCustomer) { setCustomerLoans([]); return }
    customersService.getLoanHistory(selectedCustomer.id)
      .then(r => setCustomerLoans((r.data as LoanOption[]).filter(l => l.status === 'ACTIVE')))
      .catch(() => {})
  }, [selectedCustomer])

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024)
    if (valid.length < files.length) toast.error('Algunas fotos exceden 5 MB')
    setPhotos(prev => [...prev, ...valid])
    valid.forEach(f => {
      const reader = new FileReader()
      reader.onload = () => setPhotoPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(f)
    })
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

  const handleSave = async () => {
    if (!selectedCustomer) { toast.error('Selecciona un cliente'); return }
    if (!selectedLoan) { toast.error('Selecciona un préstamo'); return }
    if (!form.description) { toast.error('Agrega una descripción'); return }
    if (!form.estimated_value) { toast.error('Ingresa el valor estimado'); return }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        customer: selectedCustomer.id,
        loan: selectedLoan,
        guarantee_type: gType,
        description: form.description,
        estimated_value: parseFloat(form.estimated_value),
        appraiser: form.appraiser,
        notes: form.notes,
      }

      if (gType === 'VEHICLE') {
        payload.vehicle = {
          make: form.make, model: form.model,
          year: parseInt(form.year) || new Date().getFullYear(),
          color: form.color, plate_number: form.plate_number,
          chassis_number: form.chassis_number,
        }
      } else if (gType === 'REAL_ESTATE') {
        payload.real_estate = {
          property_type: form.property_type, address: form.address,
          city: form.city, province: form.province,
          area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
          title_number: form.title_number,
        }
      }

      const res = await api.post('/guarantees/', payload)
      const guaranteeId = res.data.id

      for (const photo of photos) {
        const fd = new FormData()
        fd.append('file', photo)
        fd.append('document_type', 'FOTO')
        await api.post(`/guarantees/${guaranteeId}/upload_document/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      toast.success('Garantía registrada exitosamente')
      onSaved()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error registrando garantía'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" /> Registrar Garantía
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cliente <span className="text-red-500">*</span></label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{selectedCustomer.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.customer_code} · {selectedCustomer.id_number}</p>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setSelectedLoan('') }} className="text-xs text-red-500 hover:underline">Cambiar</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {customers.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomers([]) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50">
                        <p className="font-medium text-sm text-gray-900">{c.full_name}</p>
                        <p className="text-xs text-gray-400">{c.customer_code} · {c.id_number}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Préstamo */}
          {selectedCustomer && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Préstamo asociado <span className="text-red-500">*</span></label>
              {customerLoans.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">Este cliente no tiene préstamos activos</p>
              ) : (
                <select value={selectedLoan} onChange={e => setSelectedLoan(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar préstamo...</option>
                  {customerLoans.map(l => (
                    <option key={l.id} value={l.id}>{l.loan_number} — {fmt(l.principal_amount)}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Tipo de garantía */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Tipo de Garantía</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map(t => {
                const Icon = t.icon
                const active = gType === t.key
                return (
                  <button key={t.key} onClick={() => setGType(t.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${active ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Datos comunes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción <span className="text-red-500">*</span></label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={`${inputCls} resize-none`} rows={2} placeholder="Descripción detallada de la garantía..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Valor estimado (RD$) <span className="text-red-500">*</span></label>
              <input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))}
                className={inputCls} placeholder="500,000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tasador</label>
              <input value={form.appraiser} onChange={e => setForm(f => ({ ...f, appraiser: e.target.value }))}
                className={inputCls} placeholder="Nombre del tasador" />
            </div>
          </div>

          {/* Datos específicos por tipo */}
          {gType === 'VEHICLE' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2"><Car className="h-4 w-4" /> Datos del Vehículo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="block text-xs font-semibold text-blue-700 mb-1">Marca</label>
                  <input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} className={inputCls} placeholder="Toyota" /></div>
                <div><label className="block text-xs font-semibold text-blue-700 mb-1">Modelo</label>
                  <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={inputCls} placeholder="Corolla" /></div>
                <div><label className="block text-xs font-semibold text-blue-700 mb-1">Año</label>
                  <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={inputCls} placeholder="2020" /></div>
                <div><label className="block text-xs font-semibold text-blue-700 mb-1">Color</label>
                  <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className={inputCls} placeholder="Blanco" /></div>
                <div><label className="block text-xs font-semibold text-blue-700 mb-1">Placa</label>
                  <input value={form.plate_number} onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))} className={inputCls} placeholder="A123456" /></div>
                <div><label className="block text-xs font-semibold text-blue-700 mb-1">Chasis</label>
                  <input value={form.chassis_number} onChange={e => setForm(f => ({ ...f, chassis_number: e.target.value }))} className={inputCls} placeholder="VIN..." /></div>
              </div>
            </div>
          )}

          {gType === 'REAL_ESTATE' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2"><Home className="h-4 w-4" /> Datos del Inmueble</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-emerald-700 mb-1">Tipo</label>
                  <select value={form.property_type} onChange={e => setForm(f => ({ ...f, property_type: e.target.value }))} className={inputCls}>
                    <option value="HOUSE">Casa</option><option value="APARTMENT">Apartamento</option>
                    <option value="LAND">Terreno</option><option value="COMMERCIAL">Local Comercial</option><option value="OTHER">Otro</option>
                  </select></div>
                <div><label className="block text-xs font-semibold text-emerald-700 mb-1">Ciudad</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} placeholder="Santo Domingo" /></div>
                <div><label className="block text-xs font-semibold text-emerald-700 mb-1">Provincia</label>
                  <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} className={inputCls} /></div>
                <div><label className="block text-xs font-semibold text-emerald-700 mb-1">Área (m²)</label>
                  <input type="number" value={form.area_m2} onChange={e => setForm(f => ({ ...f, area_m2: e.target.value }))} className={inputCls} /></div>
                <div className="col-span-2"><label className="block text-xs font-semibold text-emerald-700 mb-1">Dirección</label>
                  <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={`${inputCls} resize-none`} rows={2} /></div>
                <div><label className="block text-xs font-semibold text-emerald-700 mb-1">No. Título</label>
                  <input value={form.title_number} onChange={e => setForm(f => ({ ...f, title_number: e.target.value }))} className={inputCls} /></div>
              </div>
            </div>
          )}

          {/* Fotos */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Fotos / Evidencias</label>
            <div className="flex flex-wrap gap-3">
              {photoPreviews.map((p, i) => (
                <div key={i} className="relative group">
                  <img src={p} alt="" className="h-20 w-20 rounded-xl object-cover border border-gray-200" />
                  <button onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()}
                className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-primary-400 hover:bg-primary-50 transition-colors">
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-[10px] text-gray-400">Agregar</span>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={`${inputCls} resize-none`} rows={2} placeholder="Observaciones adicionales..." />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium">
            <Shield className="h-4 w-4" />
            {saving ? 'Registrando...' : 'Registrar Garantía'}
          </button>
        </div>
      </div>
    </div>
  )
}
