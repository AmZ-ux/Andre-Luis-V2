import { useState } from 'react'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Save, RotateCcw } from 'lucide-react'
import type { CompanySettings } from '../../types/settings'

interface CompanySettingsProps {
  settings: CompanySettings
  onSave: (values: Partial<CompanySettings>) => void
  saved: boolean
}

export function CompanySettingsForm({ settings, onSave, saved }: CompanySettingsProps) {
  const [form, setForm] = useState<CompanySettings>(settings)

  const update = (key: keyof CompanySettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => onSave(form)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Input label="Nome da empresa" value={form.name} onChange={(e) => update('name', e.target.value)} />
        <Input label="Nome fantasia" value={form.tradingName} onChange={(e) => update('tradingName', e.target.value)} />
        <Input label="CNPJ" value={form.cnpj} onChange={(e) => update('cnpj', e.target.value)} />
        <Input label="Telefone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} />
        <Input label="E-mail" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        <Input label="Site" value={form.website} onChange={(e) => update('website', e.target.value)} />
        <Input label="CEP" value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
        <Input label="Cidade" value={form.city} onChange={(e) => update('city', e.target.value)} />
        <Input label="Estado" value={form.state} onChange={(e) => update('state', e.target.value)} />
      </div>
      <Input label="Endereço" value={form.address} onChange={(e) => update('address', e.target.value)} />
      <Textarea label="Descrição" value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setForm(settings)}>
          Desfazer
        </Button>
        <Button icon={saved ? undefined : <Save className="h-4 w-4" />} onClick={handleSave}>
          {saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
