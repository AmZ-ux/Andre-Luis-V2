import type { CompanySettings } from '../types/settings'

export function fillLegalText(text: string, company: Partial<CompanySettings>): string {
  const cityUf = [company.city, company.state].filter(Boolean).join('/') || 'cidade a informar'
  return text
    .replaceAll('{cnpj}', company.cnpj || 'CNPJ a informar')
    .replaceAll('{cidadeUf}', cityUf)
    .replaceAll('{email}', company.email || 'e-mail a informar')
    .replaceAll('{telefone}', company.phone || company.whatsapp || 'telefone a informar')
    .replaceAll('{endereco}', company.address || 'endereço a informar')
}
