import { useEffect, useState } from 'react'
import { config } from '../config'
import { realSettings } from '../services/realApi'
import { settingsService } from '../services/settingsService'
import type { CompanySettings } from '../types/settings'

const emptyCompany: Partial<CompanySettings> = {
  cnpj: '', phone: '', whatsapp: '', email: '', address: '', city: '', state: '',
}

export function useCompanyInfo(): Partial<CompanySettings> {
  const [company, setCompany] = useState<Partial<CompanySettings>>(emptyCompany)

  useEffect(() => {
    let cancelled = false
    if (!config.realApi) {
      setCompany(settingsService.get('company'))
      return
    }
    realSettings.get()
      .then((settings: any) => {
        if (!cancelled && settings?.company) setCompany(settings.company)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return company
}
