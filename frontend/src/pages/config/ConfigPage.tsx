import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Settings, Building2, Save, Upload, Image as ImageIcon,
  Database, Clock, CheckCircle, AlertTriangle, Play, RefreshCw, HardDrive,
  Download, RotateCcw, ShieldAlert, FolderOpen, Headset,
  Phone, Mail, MessageCircle, Instagram, ExternalLink, Code2, Heart,
} from 'lucide-react'
import {
  companyService, backupService,
  type CompanySettings, type BackupConfig, type BackupRecord,
} from '@/services/company'
import api from '@/services/api'
import { saveBlob } from '@/utils/download'
import toast from 'react-hot-toast'

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

export default function ConfigPage() {
  const [tab, setTab] = useState<'company' | 'backup' | 'support'>('company')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Administración general del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'company', label: 'Empresa', icon: Building2 },
          { id: 'backup',  label: 'Copias de Seguridad', icon: Database },
          { id: 'support', label: 'Soporte', icon: Headset },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'company' && <CompanyTab />}
      {tab === 'backup'  && <BackupTab />}
      {tab === 'support' && <SupportTab />}
    </div>
  )
}

// ── Tab Empresa ──────────────────────────────────────────────────────────────
function CompanyTab() {
  const [form, setForm] = useState<CompanySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    companyService.get().then(r => setForm(r.data)).catch(() => toast.error('Error cargando configuración'))
  }, [])

  const set = (k: keyof CompanySettings, v: string) => setForm(f => f ? { ...f, [k]: v } : f)

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const r = await companyService.update(form)
      setForm(r.data)
      toast.success('Configuración guardada')
    } catch { toast.error('Error guardando') } finally { setSaving(false) }
  }

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const r = await companyService.uploadLogo(file)
      setForm(r.data)
      toast.success('Logo actualizado')
    } catch { toast.error('Error subiendo logo') } finally { setUploadingLogo(false) }
  }

  if (!form) return <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>

  return (
    <div className="space-y-6">
      {/* Identidad */}
      <Section title="Identidad de la Empresa" icon={<Building2 className="h-4 w-4" />}>
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 items-start">
          {/* Logo */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Logo</p>
            <div className="w-44 h-44 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center overflow-hidden mb-2">
              {form.logo
                ? <img src={form.logo} alt="logo" className="w-full h-full object-contain" />
                : <ImageIcon className="h-10 w-10 text-gray-300" />
              }
            </div>
            <label className="flex items-center justify-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs cursor-pointer hover:bg-primary-100 font-medium">
              <Upload className="h-3.5 w-3.5" />
              {uploadingLogo ? 'Subiendo...' : (form.logo ? 'Cambiar logo' : 'Subir logo')}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploadingLogo} />
            </label>
          </div>

          {/* Datos básicos */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre comercial *">
                <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className={inputCls} placeholder="Mi Financiera S.A." />
              </Field>
              <Field label="Razón social">
                <input value={form.legal_name} onChange={e => set('legal_name', e.target.value)} className={inputCls} placeholder="Nombre legal de la empresa" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RNC / NIT">
                <input value={form.tax_id} onChange={e => set('tax_id', e.target.value)} className={inputCls} placeholder="000000000" />
              </Field>
              <Field label="Sitio web">
                <input value={form.website} onChange={e => set('website', e.target.value)} className={inputCls} placeholder="https://..." />
              </Field>
            </div>
          </div>
        </div>
      </Section>

      {/* Contacto */}
      <Section title="Información de Contacto">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dirección"><input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} /></Field>
          <Field label="Ciudad"><input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} /></Field>
          <Field label="Provincia"><input value={form.province} onChange={e => set('province', e.target.value)} className={inputCls} /></Field>
          <Field label="País"><input value={form.country} onChange={e => set('country', e.target.value)} className={inputCls} /></Field>
          <Field label="Teléfono"><input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="809-000-0000" /></Field>
          <Field label="Teléfono 2"><input value={form.phone2} onChange={e => set('phone2', e.target.value)} className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} /></Field>
          <Field label="WhatsApp Business"><input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className={inputCls} placeholder="809-000-0000" /></Field>
          <Field label="Facebook"><input value={form.facebook} onChange={e => set('facebook', e.target.value)} className={inputCls} placeholder="@usuario o URL" /></Field>
          <Field label="Instagram"><input value={form.instagram} onChange={e => set('instagram', e.target.value)} className={inputCls} placeholder="@usuario" /></Field>
        </div>
      </Section>

      {/* Configuración monetaria */}
      <Section title="Configuración Monetaria">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Moneda (código)"><input value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls} maxLength={3} /></Field>
          <Field label="Símbolo"><input value={form.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} className={inputCls} maxLength={5} /></Field>
          <Field label="Zona horaria"><input value={form.timezone} onChange={e => set('timezone', e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Cuentas bancarias (para depósitos)">
          <textarea value={form.bank_accounts} onChange={e => set('bank_accounts', e.target.value)} rows={3} className={`${inputCls} resize-none`}
            placeholder="Banco Popular: 800-000-000-1&#10;Banreservas: 900-000-000-2" />
        </Field>
      </Section>

      {/* Pie de documentos */}
      <Section title="Personalización de Documentos">
        <Field label="Pie de página en recibos de pago (WhatsApp / impresos)">
          <textarea value={form.receipt_footer} onChange={e => set('receipt_footer', e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="¡Gracias por su preferencia!" />
        </Field>
        <Field label="Pie de página en estados de cuenta">
          <textarea value={form.statement_footer} onChange={e => set('statement_footer', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </Field>
        <Field label="Aviso legal (contratos)">
          <textarea value={form.legal_notice} onChange={e => set('legal_notice', e.target.value)} rows={3} className={`${inputCls} resize-none`}
            placeholder="Texto legal que aparecerá en los contratos..." />
        </Field>
      </Section>

      {/* Vista previa */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm">
        <p className="font-semibold text-blue-700 mb-2">📋 Vista previa en recibos:</p>
        <div className="bg-white border border-blue-200 rounded-lg p-3 font-mono text-xs whitespace-pre-line">
          {`✅ *RECIBO DE PAGO - ${form.company_name}*`}{`\n`}
          {`━━━━━━━━━━━━━━━━━━━━━━━━`}{`\n`}
          {`💰 *Total pagado: ${form.currency_symbol}2,500.00*`}{`\n`}
          {`━━━━━━━━━━━━━━━━━━━━━━━━`}{`\n`}
          {form.receipt_footer || '¡Gracias!'}{`\n`}
          {`_${form.company_name}_`}{`\n`}
          {form.phone && `📞 ${form.phone}`}
        </div>
      </div>

      {/* Guardar */}
      <div className="sticky bottom-4 flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 disabled:opacity-60 font-semibold">
          <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  )
}

// ── Tab Backup ───────────────────────────────────────────────────────────────
function BackupTab() {
  const [config, setConfig]     = useState<BackupConfig | null>(null)
  const [records, setRecords]   = useState<BackupRecord[]>([])
  const [running, setRunning]   = useState(false)
  const [savingCfg, setSavingCfg] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([backupService.getConfig(), backupService.list()])
      setConfig(c.data); setRecords(l.data.results)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  // ── Crear backup ────────────────────────────────────────────────────────────
  const handleRunBackup = async () => {
    if (!confirm('¿Crear una copia de seguridad ahora?')) return
    setRunning(true)
    try {
      const r = await backupService.runNow()
      toast.success(r.data.message, { icon: '💾' })
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Error en backup')
    } finally { setRunning(false) }
  }

  // ── Descargar backup ────────────────────────────────────────────────────────
  const handleDownload = async (record: BackupRecord) => {
    if (record.status !== 'COMPLETED') { toast.error('Solo se pueden descargar backups completados'); return }
    setDownloading(record.id)
    try {
      // Usar axios (auto-refresh del token + cookies) para evitar fallos por token expirado
      const path = backupService.downloadUrl(record.id).replace(/^\/api\/v1/, '')
      const response = await api.get(path, { responseType: 'blob', timeout: 120_000 })

      const blob = response.data as Blob
      const saved = await saveBlob(blob, record.file_name)
      if (saved) toast.success(`Backup guardado: ${record.file_name}`, { icon: '⬇️' })
    } catch {
      toast.error('Error descargando el backup')
    } finally { setDownloading(null) }
  }

  // ── Restaurar backup ────────────────────────────────────────────────────────
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.sqlite3')) {
      toast.error('Solo se aceptan archivos .sqlite3')
      e.target.value = ''
      return
    }

    const confirmed = confirm(
      `⚠️ ADVERTENCIA: Restaurar el backup "${file.name}" reemplazará TODOS los datos actuales.\n\n` +
      `El sistema guardará una copia de emergencia automáticamente antes de restaurar.\n\n` +
      `¿Deseas continuar?`
    )
    if (!confirmed) { e.target.value = ''; return }

    setRestoring(true)
    try {
      const r = await backupService.restore(file)
      toast.success(r.data.message, { icon: '✅', duration: 6000 })
      // Recargar la app para reflejar los datos restaurados
      setTimeout(() => window.location.reload(), 2000)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Error restaurando backup', { duration: 6000 })
    } finally {
      setRestoring(false)
      if (restoreInputRef.current) restoreInputRef.current.value = ''
    }
  }

  const handleSaveCfg = async () => {
    if (!config) return
    setSavingCfg(true)
    try {
      const r = await backupService.updateConfig(config)
      setConfig(r.data)
      toast.success('Configuración guardada')
    } catch { toast.error('Error') } finally { setSavingCfg(false) }
  }

  const setCfg = <K extends keyof BackupConfig>(k: K, v: BackupConfig[K]) =>
    setConfig(c => c ? { ...c, [k]: v } : c)

  if (!config) return <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>

  const STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
    COMPLETED:   { color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="h-3 w-3" /> },
    FAILED:      { color: 'bg-red-100 text-red-700',         icon: <AlertTriangle className="h-3 w-3" /> },
    IN_PROGRESS: { color: 'bg-blue-100 text-blue-700',       icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  }

  return (
    <div className="space-y-6">
      {/* ── Acciones principales ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Crear backup */}
        <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-100 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
            <HardDrive className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-sm">Crear Copia de Seguridad</h3>
            <p className="text-xs text-gray-500 mt-0.5">Genera backup inmediato y luego descárgalo</p>
          </div>
          <button onClick={handleRunBackup} disabled={running}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 text-sm shrink-0">
            <Play className="h-4 w-4" /> {running ? 'Creando...' : 'Crear'}
          </button>
        </div>

        {/* Restaurar */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
            <RotateCcw className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-sm">Restaurar desde Archivo</h3>
            <p className="text-xs text-gray-500 mt-0.5">Sube un archivo .sqlite3 para recuperar datos</p>
          </div>
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shrink-0 cursor-pointer ${restoring ? 'bg-gray-300 text-gray-500' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
            <FolderOpen className="h-4 w-4" />
            {restoring ? 'Restaurando...' : 'Seleccionar'}
            <input ref={restoreInputRef} type="file" accept=".sqlite3" className="hidden"
              onChange={handleRestoreFile} disabled={restoring} />
          </label>
        </div>
      </div>

      {/* Advertencia restaurar */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <p className="font-bold mb-1">¿Cómo funciona la descarga y restauración?</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Haz clic en <strong>Crear</strong> para generar el backup en el servidor.</li>
            <li>Luego haz clic en el botón <strong className="inline-flex items-center gap-1"><Download className="h-3 w-3" />Descargar</strong> en la fila del backup — el navegador te pedirá la carpeta donde guardar.</li>
            <li>Para recuperar datos, haz clic en <strong>Seleccionar</strong> y elige el archivo <code>.sqlite3</code> descargado anteriormente.</li>
            <li>El sistema guarda una copia de emergencia automática antes de restaurar.</li>
          </ol>
        </div>
      </div>

      {/* Configuración programada */}
      <Section title="Backup Programado" icon={<Clock className="h-4 w-4" />}>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Activar backups automáticos</p>
            <p className="text-xs text-gray-500">El sistema creará copias según la frecuencia configurada</p>
          </div>
          <button onClick={() => setCfg('enabled', !config.enabled)}
            className={`relative w-14 h-7 rounded-full transition-colors ${config.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-7' : ''}`} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Frecuencia">
            <select value={config.frequency} onChange={e => setCfg('frequency', e.target.value)} className={inputCls}>
              <option value="DAILY">Diario</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensual</option>
              <option value="MANUAL">Solo Manual</option>
            </select>
          </Field>
          <Field label="Hora del día">
            <input type="time" value={config.time_of_day} onChange={e => setCfg('time_of_day', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Días de retención">
            <input type="number" min={1} value={config.retention_days} onChange={e => setCfg('retention_days', parseInt(e.target.value) || 30)} className={inputCls} />
          </Field>
        </div>
        <Field label="Notificar a (correos, uno por línea)">
          <textarea value={config.notify_emails} onChange={e => setCfg('notify_emails', e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="admin@empresa.com" />
        </Field>
        <div className="flex justify-end mt-3">
          <button onClick={handleSaveCfg} disabled={savingCfg}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 text-sm font-medium">
            <Save className="h-4 w-4" /> {savingCfg ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </Section>

      {/* Historial con botón descargar */}
      <Section title={`Historial de Backups (${records.length})`} icon={<Database className="h-4 w-4" />}>
        {records.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Sin backups registrados aún. Crea el primero arriba.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Archivo', 'Tamaño', 'Origen', 'Estado', 'Fecha', 'Duración', 'Usuario', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(r => {
                  const meta = STATUS_META[r.status] || { color: 'bg-gray-100 text-gray-600', icon: null }
                  const isDownloading = downloading === r.id
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600 max-w-xs truncate">{r.file_name}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{r.file_size_mb} MB</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{r.trigger_display}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                          {meta.icon}{r.status_display}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{r.started_at ? new Date(r.started_at).toLocaleString('es-DO') : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{r.duration_seconds ? `${r.duration_seconds}s` : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{r.triggered_by_name}</td>
                      <td className="px-3 py-2.5">
                        {r.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleDownload(r)}
                            disabled={isDownloading}
                            title="Descargar este backup"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg text-xs font-medium hover:bg-primary-100 disabled:opacity-60 transition-colors">
                            {isDownloading
                              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              : <Download className="h-3.5 w-3.5" />}
                            {isDownloading ? 'Descargando...' : 'Descargar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Tab Soporte ─────────────────────────────────────────────────────────────
function SupportTab() {
  const contactLinks = [
    {
      icon: <Phone className="h-5 w-5" />,
      label: 'Teléfono',
      value: '849-442-2733',
      href: 'tel:+18494422733',
      color: 'bg-blue-50 border-blue-100 text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      icon: <MessageCircle className="h-5 w-5" />,
      label: 'WhatsApp',
      value: '849-442-2733',
      href: 'https://wa.me/18494422733',
      color: 'bg-green-50 border-green-100 text-green-700',
      iconBg: 'bg-green-100',
    },
    {
      icon: <Mail className="h-5 w-5" />,
      label: 'Correo Electrónico',
      value: 'sandoval.pm12@gmail.com',
      href: 'mailto:sandoval.pm12@gmail.com',
      color: 'bg-red-50 border-red-100 text-red-700',
      iconBg: 'bg-red-100',
    },
    {
      icon: <Instagram className="h-5 w-5" />,
      label: 'Instagram',
      value: '@sandoval.pm',
      href: 'https://instagram.com/sandoval.pm',
      color: 'bg-purple-50 border-purple-100 text-purple-700',
      iconBg: 'bg-purple-100',
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-8 text-center text-white shadow-lg">
        <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4">
          <Headset className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-black">Soporte Técnico</h2>
        <p className="text-primary-100 mt-2 text-sm">
          ¿Necesitas ayuda? Estoy disponible para asistirte con cualquier situación del sistema.
        </p>
      </div>

      {/* Desarrollador */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-md">
            <span className="text-2xl font-black text-white">RS</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Ronny Sandoval</h3>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
              <Code2 className="h-3.5 w-3.5" /> Desarrollador del Sistema
            </p>
          </div>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {contactLinks.map(c => (
            <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-md hover:scale-[1.02] ${c.color}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg}`}>
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold opacity-70">{c.label}</p>
                <p className="font-bold text-sm truncate">{c.value}</p>
              </div>
              <ExternalLink className="h-4 w-4 opacity-40 shrink-0" />
            </a>
          ))}
        </div>
      </div>

      {/* Horarios */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary-500" /> Horario de Soporte
        </h3>
        <div className="space-y-2">
          {[
            { day: 'Lunes a Viernes', hours: '8:00 AM - 6:00 PM', active: true },
            { day: 'Sábados', hours: '9:00 AM - 1:00 PM', active: true },
            { day: 'Domingos y Feriados', hours: 'Solo emergencias vía WhatsApp', active: false },
          ].map(s => (
            <div key={s.day} className={`flex items-center justify-between py-3 px-4 rounded-lg ${s.active ? 'bg-emerald-50' : 'bg-gray-50'}`}>
              <span className="text-sm font-medium text-gray-700">{s.day}</span>
              <span className={`text-sm font-semibold ${s.active ? 'text-emerald-600' : 'text-gray-400'}`}>{s.hours}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
          Hecho con <Heart className="h-3 w-3 text-red-400 fill-red-400" /> por Ronny Sandoval
        </p>
        <p className="text-xs text-gray-300 mt-1">CredCore v1.0 — Sistema de Gestión de Créditos</p>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm mb-4">
        {icon || <Settings className="h-4 w-4 text-primary-600" />}{title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
