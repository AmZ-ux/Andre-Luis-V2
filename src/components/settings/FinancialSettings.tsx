import { useState } from 'react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Button } from '../ui/Button'
import { Save, RotateCcw } from 'lucide-react'
import type { FinancialSettings } from '../../types/settings'

interface FinancialSettingsFormProps {
  settings: FinancialSettings
  onSave: (values: Partial<FinancialSettings>) => void
  saved: boolean
}

export function FinancialSettingsForm({ settings, onSave, saved }: FinancialSettingsFormProps) {
  const [form, setForm] = useState<FinancialSettings>(settings)

  const update = <K extends keyof FinancialSettings>(key: K, value: FinancialSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Select
          label="Moeda"
          options={[{ value: 'BRL', label: 'Real (R$)' }, { value: 'USD', label: 'Dólar ($)' }, { value: 'EUR', label: 'Euro (€)' }]}
          value={form.currency}
          onChange={(e) => update('currency', e.target.value)}
        />
        <Select
          label="Casas decimais"
          options={[{ value: '0', label: '0' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]}
          value={String(form.decimalPlaces)}
          onChange={(e) => update('decimalPlaces', parseInt(e.target.value))}
        />
        <Input
          label="Dia padrão de vencimento"
          type="number"
          min={1} max={31}
          value={form.defaultDueDay}
          onChange={(e) => update('defaultDueDay', parseInt(e.target.value) || 10)}
        />
        <Input
          label="Valor padrão da mensalidade (R$)"
          type="number"
          step="0.01"
          value={form.defaultMonthlyFee}
          onChange={(e) => update('defaultMonthlyFee', parseFloat(e.target.value) || 0)}
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-text">Opções</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Switch label="Vencimentos personalizados" checked={form.allowCustomDueDate} onChange={(e) => update('allowCustomDueDate', e.target.checked)} />
          <Switch label="Permitir desconto" checked={form.allowDiscount} onChange={(e) => update('allowDiscount', e.target.checked)} />
          <Switch label="Permitir multa" checked={form.allowLateFee} onChange={(e) => update('allowLateFee', e.target.checked)} />
          <Switch label="Permitir juros" checked={form.allowInterest} onChange={(e) => update('allowInterest', e.target.checked)} />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setForm(settings)}>
          Desfazer
        </Button>
        <Button icon={saved ? undefined : <Save className="h-4 w-4" />} onClick={() => onSave(form)}>
          {saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
