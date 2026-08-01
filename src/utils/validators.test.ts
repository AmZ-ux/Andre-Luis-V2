import { describe, it, expect } from 'vitest'
import { validateCpf, validatePhone, validateCep, validateEmail, validateRequired, validateMinLength, validateMaxLength, validateNumeric } from './validators'

describe('validateCpf', () => {
  it('returns true for valid CPF', () => {
    expect(validateCpf('529.982.247-25')).toBe(true)
  })

  it('returns false for invalid CPF', () => {
    expect(validateCpf('123.456.789-00')).toBe(false)
  })

  it('returns false for repeated digits', () => {
    expect(validateCpf('111.111.111-11')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateCpf('')).toBe(false)
  })
})

describe('validatePhone', () => {
  it('returns true for valid phone with 10 digits', () => {
    expect(validatePhone('(11) 1234-5678')).toBe(true)
  })

  it('returns true for valid phone with 11 digits (cell)', () => {
    expect(validatePhone('(11) 91234-5678')).toBe(true)
  })

  it('returns false for short phone', () => {
    expect(validatePhone('123')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validatePhone('')).toBe(false)
  })
})

describe('validateCep', () => {
  it('returns true for valid CEP', () => {
    expect(validateCep('01310-100')).toBe(true)
  })

  it('returns false for invalid CEP', () => {
    expect(validateCep('123')).toBe(false)
  })
})

describe('validateEmail', () => {
  it('returns true for valid email', () => {
    expect(validateEmail('teste@exemplo.com')).toBe(true)
  })

  it('returns true for email with subdomain', () => {
    expect(validateEmail('teste@sub.exemplo.com')).toBe(true)
  })

  it('returns false for email without @', () => {
    expect(validateEmail('teste')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateEmail('')).toBe(false)
  })
})

describe('validateRequired', () => {
  it('returns true for non-empty string', () => {
    expect(validateRequired('texto')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(validateRequired('')).toBe(false)
  })

  it('returns false for whitespace only', () => {
    expect(validateRequired('   ')).toBe(false)
  })
})

describe('validateMinLength', () => {
  it('returns true when value meets minimum', () => {
    expect(validateMinLength('abcde', 3)).toBe(true)
  })

  it('returns false when value is too short', () => {
    expect(validateMinLength('ab', 3)).toBe(false)
  })
})

describe('validateMaxLength', () => {
  it('returns true when value does not exceed maximum', () => {
    expect(validateMaxLength('abc', 5)).toBe(true)
  })

  it('returns false when value exceeds maximum', () => {
    expect(validateMaxLength('abcdef', 5)).toBe(false)
  })
})

describe('validateNumeric', () => {
  it('returns true for integer string', () => {
    expect(validateNumeric('123')).toBe(true)
  })

  it('returns true for decimal string', () => {
    expect(validateNumeric('123.45')).toBe(true)
  })

  it('returns false for non-numeric string', () => {
    expect(validateNumeric('abc')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateNumeric('')).toBe(false)
  })
})
