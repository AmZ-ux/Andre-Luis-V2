import { describe, it, expect } from 'vitest'
import { sanitizeInput, stripTags, maskCpf, maskCnpj, sanitizeFilename, encodeHtmlEntities } from './security'

describe('sanitizeInput', () => {
  it('removes angle brackets and quotes', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script')
  })
  it('removes quotes', () => {
    expect(sanitizeInput("it's a test \"he said\"")).toBe('its a test he said')
  })
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })
})

describe('stripTags', () => {
  it('removes HTML tags', () => {
    expect(stripTags('<p>Olá</p>')).toBe('Olá')
  })
  it('removes nested tags', () => {
    expect(stripTags('<div><span>texto</span></div>')).toBe('texto')
  })
  it('returns empty for only tags', () => {
    expect(stripTags('<br/>')).toBe('')
  })
})

describe('maskCpf', () => {
  it('masks middle digits of CPF', () => {
    expect(maskCpf('529.982.247-25')).toMatch(/529\.\*\*\*\.\*\*\*-25/)
  })
  it('handles unformatted CPF', () => {
    expect(maskCpf('52998224725')).toMatch(/529\.\*\*\*\.\*\*\*-25/)
  })
})

describe('maskCnpj', () => {
  it('masks middle digits of CNPJ', () => {
    expect(maskCnpj('11.222.333/0001-81')).toMatch(/11\.\*\*\*\.\*\*\*\/0001-81/)
  })
})

describe('sanitizeFilename', () => {
  it('replaces dangerous characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd')
  })
  it('preserves valid characters', () => {
    expect(sanitizeFilename('relatorio_2026.pdf')).toBe('relatorio_2026.pdf')
  })
  it('truncates long filenames', () => {
    const long = 'a'.repeat(300)
    expect(sanitizeFilename(long).length).toBe(255)
  })
})

describe('encodeHtmlEntities', () => {
  it('encodes special characters', () => {
    expect(encodeHtmlEntities('<b>"Foo" & \'Bar\'</b>')).toBe('&lt;b&gt;&quot;Foo&quot; &amp; &#x27;Bar&#x27;&lt;/b&gt;')
  })
})
