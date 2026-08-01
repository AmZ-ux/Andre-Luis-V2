export function sanitizeInput(value: string): string {
  return value
    .trim()
    .replace(/[<>]/g, '')
    .replace(/['"]/g, '')
}

export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

export function maskCpf(value: string): string {
  return value.replace(/(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})/, '$1.***.***-$4')
}

export function maskCnpj(value: string): string {
  return value.replace(/(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})/, '$1.***.***/$4-$5')
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255)
}

export function encodeHtmlEntities(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}
