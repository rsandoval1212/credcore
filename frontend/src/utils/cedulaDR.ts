/**
 * Validación de cédula dominicana usando el algoritmo del dígito verificador.
 * Formato: 000-0000000-0 (11 dígitos, último es el verificador).
 */

const WEIGHTS = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]

export function isValidCedulaDR(cedula: string): boolean {
  const digits = (cedula || '').replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false  // todos iguales (000...0)

  let sum = 0
  for (let i = 0; i < 10; i++) {
    let product = parseInt(digits[i], 10) * WEIGHTS[i]
    if (product >= 10) product = Math.floor(product / 10) + (product % 10)
    sum += product
  }
  const expected = (10 - (sum % 10)) % 10
  return expected === parseInt(digits[10], 10)
}

export function formatCedulaDR(cedula: string): string {
  const digits = (cedula || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`
}
