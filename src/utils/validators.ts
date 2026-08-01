export function validateCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false

  const calc = (digits: string, factor: number): number => {
    let sum = 0
    for (const d of digits) sum += Number(d) * factor--
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const d1 = calc(digits.slice(0, 9), 10)
  if (d1 !== Number(digits[9])) return false

  const d2 = calc(digits.slice(0, 10), 11)
  return d2 === Number(digits[10])
}

export function validatePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 11
}

export function validateCep(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length === 8
}

export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function validateRequired(value: string): boolean {
  return value.trim().length > 0
}

export function validateMinLength(value: string, min: number): boolean {
  return value.trim().length >= min
}

export function validateMaxLength(value: string, max: number): boolean {
  return value.trim().length <= max
}

export function validateNumeric(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value)
}
