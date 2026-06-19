import { useState } from 'react'
import { Upload, Loader2, AlertCircle, CheckCircle2, FileJson } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface PreviewResp {
  meta?: Record<string, unknown>
  customers: { total: number; new: number; duplicated: number }
  loans: { total: number }
  payments: { total: number }
  guarantees: { total: number }
}

interface ImportResp {
  success: boolean
  imported: Record<string, number>
  errors_sample: string[]
}

export default function BulkSyncImport() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [result, setResult] = useState<ImportResp | null>(null)
  const [loading, setLoading] = useState(false)

  const reset = () => { setFile(null); setPreview(null); setResult(null) }

  const handlePreview = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post<PreviewResp>('/system/bulk-sync/preview/', fd)
      setPreview(r.data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Error procesando archivo')
    } finally { setLoading(false) }
  }

  const handleImport = async () => {
    if (!file) return
    if (!window.confirm('¿Confirmar importación? Esta acción no se puede deshacer (aunque los duplicados se respetan).')) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post<ImportResp>('/system/bulk-sync/import/', fd, { timeout: 300_000 })
      setResult(r.data)
      const n = r.data.imported
      toast.success(`${n.customers} clientes, ${n.loans} préstamos, ${n.payments} cobros importados`, { duration: 6000 })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Error en la importación')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-b border-purple-100 dark:border-purple-900">
        <div className="flex items-center gap-3">
          <FileJson className="h-5 w-5 text-purple-600" />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Importación masiva de datos</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Importa clientes, préstamos, cobros y garantías desde un archivo JSON. Idempotente: no duplica registros existentes.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {!preview && !result && (
          <>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-1">Formato esperado:</p>
              <pre className="bg-white/70 dark:bg-gray-900/50 rounded p-2 mt-1 overflow-auto text-[10px]">{`{
  "meta": { "source": "...", "generated_at": "..." },
  "customers": [{ "id_number": "001-...", "first_name": "...", ... }],
  "loans":     [{ "customer_id_number": "001-...", "amount": 25000, ... }],
  "payments":  [{ "loan_reference": "...", "total_amount": 2500, ... }],
  "guarantees":[{ "customer_id_number": "001-...", "type": "VEHICLE", ... }]
}`}</pre>
            </div>

            <label className="block">
              <input type="file" accept=".json,application/json"
                onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
              <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'}`}>
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                {file ? (
                  <>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Haz clic para seleccionar un archivo .json</p>
                )}
              </div>
            </label>

            <button onClick={handlePreview} disabled={!file || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {loading ? 'Analizando...' : 'Previsualizar contenido'}
            </button>
          </>
        )}

        {preview && !result && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <PreviewBox label="Clientes" total={preview.customers.total} dup={preview.customers.duplicated} newCount={preview.customers.new} />
              <PreviewBox label="Préstamos" total={preview.loans.total} />
              <PreviewBox label="Cobros" total={preview.payments.total} />
              <PreviewBox label="Garantías" total={preview.guarantees.total} />
            </div>
            {preview.customers.duplicated > 0 && (
              <div className="flex gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{preview.customers.duplicated} clientes ya existen en tu base. Se saltarán automáticamente para no duplicar.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={handleImport} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {loading ? 'Importando...' : 'Confirmar importación'}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-bold text-emerald-900 dark:text-emerald-100">Importación completada</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <ResultRow label="Clientes nuevos" value={result.imported.customers} />
              <ResultRow label="Préstamos nuevos" value={result.imported.loans} />
              <ResultRow label="Cobros nuevos" value={result.imported.payments} />
              <ResultRow label="Garantías nuevas" value={result.imported.guarantees} />
              <ResultRow label="Clientes ya existentes (saltados)" value={result.imported.skipped_customers} dim />
              <ResultRow label="Préstamos saltados" value={result.imported.skipped_loans} dim />
              {result.imported.errors > 0 && (
                <ResultRow label="Errores" value={result.imported.errors} alert />
              )}
            </div>
            {result.errors_sample.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-red-600 font-medium">Ver detalle de errores ({result.errors_sample.length})</summary>
                <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded p-2 space-y-1 max-h-40 overflow-auto">
                  {result.errors_sample.map((e, i) => <p key={i} className="text-red-700 dark:text-red-300 font-mono">{e}</p>)}
                </div>
              </details>
            )}
            <button onClick={reset} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium">
              Importar otro archivo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PreviewBox({ label, total, newCount, dup }: { label: string; total: number; newCount?: number; dup?: number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
      {newCount !== undefined && (
        <p className="text-[10px] text-emerald-600 mt-1">{newCount} nuevos · {dup} ya existen</p>
      )}
    </div>
  )
}

function ResultRow({ label, value, dim, alert }: { label: string; value: number; dim?: boolean; alert?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg p-2 ${alert ? 'bg-red-50 dark:bg-red-900/20' : dim ? 'opacity-60' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
      <span className={`text-xs ${alert ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
      <span className={`font-bold ${alert ? 'text-red-700' : dim ? 'text-gray-700 dark:text-gray-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{value}</span>
    </div>
  )
}
