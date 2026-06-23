import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, ChevronRight, ChevronLeft, Building2, Image as ImageIcon,
  Package, Users, Sparkles, CheckCircle2, Loader2, Upload,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

const ONBOARDING_DONE_KEY = 'credcore-onboarding-done-v1'

interface Props {
  forceShow?: boolean
}

export default function OnboardingWizard({ forceShow = false }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Empresa
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Producto
  const [productName, setProductName] = useState('Préstamo Personal')
  const [defaultRate, setDefaultRate] = useState('10')

  // Datos demo
  const [loadDemo, setLoadDemo] = useState(false)

  useEffect(() => {
    if (forceShow) { setOpen(true); return }
    const done = localStorage.getItem(ONBOARDING_DONE_KEY)
    if (done === 'true') return

    // Si NO hay clientes ni préstamos en el sistema, abrir wizard
    Promise.all([
      api.get('/customers/', { params: { page_size: 1 } }).then(r => r.data.count || 0).catch(() => -1),
      api.get('/loans/', { params: { page_size: 1 } }).then(r => r.data.count || 0).catch(() => -1),
    ]).then(([cust, loans]) => {
      if (cust === 0 && loans === 0) {
        setOpen(true)
      } else if (cust > 0 || loans > 0) {
        localStorage.setItem(ONBOARDING_DONE_KEY, 'true')
      }
    })
  }, [forceShow])

  const skipForever = () => {
    if (window.confirm('¿Saltar la configuración inicial? La puedes volver a abrir desde Configuración → Empresa cuando quieras.')) {
      localStorage.setItem(ONBOARDING_DONE_KEY, 'true')
      setOpen(false)
    }
  }

  const skipForNow = () => {
    setOpen(false)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLogoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  const next = () => setStep(s => Math.min(s + 1, 4))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const finish = async () => {
    setSaving(true)
    try {
      // Paso 1-2: empresa + logo
      if (companyName || phone || address) {
        await api.patch('/dashboard/company/', {
          company_name: companyName, phone, address,
        })
      }
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        await api.patch('/dashboard/company/', fd)
      }

      // Paso 3: producto
      if (productName) {
        try {
          await api.post('/loan-products/', {
            name: productName,
            code: `P-${Date.now().toString(36).toUpperCase().slice(-6)}`,
            min_amount: 1000, max_amount: 1000000,
            min_term_months: 1, max_term_months: 60,
            interest_rate_default: parseFloat(defaultRate) || 10,
            is_active: true,
          })
        } catch {/* Si falla (ya existe uno), ignorar */}
      }

      // Paso 4: datos demo (opcional)
      if (loadDemo) {
        await loadDemoData()
      }

      localStorage.setItem(ONBOARDING_DONE_KEY, 'true')
      toast.success('¡Configuración completada!', { icon: '🎉', duration: 4000 })
      setOpen(false)
      navigate('/dashboard')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Error guardando configuración')
    } finally { setSaving(false) }
  }

  const loadDemoData = async () => {
    const demoCustomers = [
      { id_number: 'DEMO-001', first_name: 'María', last_name: 'Demo', phone1: '8095550001' },
      { id_number: 'DEMO-002', first_name: 'Carlos', last_name: 'Demo', phone1: '8095550002' },
      { id_number: 'DEMO-003', first_name: 'Ana', last_name: 'Demo', phone1: '8095550003' },
    ]
    const pkg = {
      meta: { source: 'onboarding-demo' },
      customers: demoCustomers.map(c => ({
        ...c, id_type: 'OTHER', gender: 'M', customer_type: 'NATURAL', status: 'ACTIVE',
      })),
      loans: [], payments: [], guarantees: [],
    }
    try {
      await api.post('/system/bulk-sync/import/', pkg)
      toast.success('Datos de ejemplo cargados (puedes borrarlos cuando quieras)', { duration: 5000 })
    } catch {/* silenciar */}
  }

  if (!open) return null

  const steps = [
    { icon: Sparkles, label: 'Bienvenida' },
    { icon: Building2, label: 'Empresa' },
    { icon: ImageIcon, label: 'Logo' },
    { icon: Package, label: 'Producto' },
    { icon: CheckCircle2, label: 'Listo' },
  ]

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Configuración inicial</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={skipForNow} className="text-xs text-gray-400 hover:text-gray-600">Más tarde</button>
            <button onClick={skipForever} title="No mostrar más"><X className="h-5 w-5 text-gray-400" /></button>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-1 overflow-x-auto">
          {steps.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  active ? 'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900/40' :
                  done ? 'bg-emerald-500 text-white' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={`text-[11px] font-medium ${active ? 'text-primary-700 dark:text-primary-400' : 'text-gray-400'}`}>{s.label}</span>
                {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300 mx-1" />}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-100 to-emerald-100 dark:from-primary-900/40 dark:to-emerald-900/40 rounded-full flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">¡Bienvenido a CredCore!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Vamos a configurar el sistema en 4 pasos rápidos. Tardará menos de 2 minutos. Puedes saltar pasos y completarlos después.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-left max-w-md mx-auto">
                <Quick icon="🏢" text="Datos de tu empresa" />
                <Quick icon="🎨" text="Logo en recibos y contratos" />
                <Quick icon="📦" text="Primer producto de préstamo" />
                <Quick icon="👥" text="Datos de ejemplo (opcional)" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Building2 className="h-5 w-5 text-primary-600" /> Datos de tu empresa</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aparecerán en recibos, contratos y PDFs.</p>
              <Field label="Nombre comercial">
                <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="Ej: Préstamos JT"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
              </Field>
              <Field label="Teléfono / WhatsApp">
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="809-555-1234"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
              </Field>
              <Field label="Dirección">
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
                  placeholder="Calle, número, sector, municipio"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary-600" /> Logo de tu empresa</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Saldrá automáticamente en TODOS los PDFs (recibos, contratos, tablas de amortización).
                Puedes subirlo después desde Configuración.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-700 overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-xl cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/40 text-sm font-medium w-fit">
                    <Upload className="h-4 w-4" />
                    {logoFile ? 'Cambiar logo' : 'Subir logo'}
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                  <p className="text-[11px] text-gray-400 mt-2">PNG, JPG, SVG. El sistema lo optimiza automáticamente.</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Package className="h-5 w-5 text-primary-600" /> Primer producto de préstamo</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Define tu producto estándar. Lo puedes editar y crear más después.
              </p>
              <Field label="Nombre del producto">
                <input value={productName} onChange={e => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
              </Field>
              <Field label="Tasa de interés mensual por defecto (%)">
                <input type="number" step="0.01" value={defaultRate} onChange={e => setDefaultRate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Users className="h-5 w-5 text-primary-600" /> Datos para empezar</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Para que veas el sistema funcionando podemos cargar 3 clientes de prueba que puedes borrar después.
              </p>
              <label className="flex items-start gap-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-primary-400 transition-colors">
                <input type="checkbox" checked={loadDemo} onChange={e => setLoadDemo(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cargar 3 clientes de ejemplo</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    María Demo, Carlos Demo y Ana Demo. Tienen "DEMO" en la cédula para que los reconozcas y borres después.
                  </p>
                </div>
              </label>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">¡Estás listo para empezar!</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Al finalizar irás al dashboard. Si tienes dudas, usa el botón verde "Ayuda" abajo a la derecha (manda WhatsApp directo al soporte).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <button onClick={prev} disabled={step === 0}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-700">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          {step < 4 ? (
            <button onClick={next}
              className="flex items-center gap-1 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={finish} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Guardando...' : 'Finalizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Quick({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <span className="text-lg">{icon}</span>
      <span className="text-xs text-gray-700 dark:text-gray-300">{text}</span>
    </div>
  )
}

// Hook + componente para abrir manualmente desde Configuración
export function OnboardingRestartButton() {
  const [forceShow, setForceShow] = useState(false)
  return (
    <>
      <button onClick={() => { localStorage.removeItem(ONBOARDING_DONE_KEY); setForceShow(true) }}
        className="text-xs text-primary-600 hover:underline">
        Volver a ejecutar configuración inicial
      </button>
      {forceShow && <OnboardingWizard forceShow />}
    </>
  )
}

export const ONBOARDING_STORAGE_KEY = ONBOARDING_DONE_KEY
