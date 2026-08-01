import { useState } from 'react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Button } from '../ui/Button'
import { Save, RotateCcw } from 'lucide-react'
import type { BillingSettings } from '../../types/settings'

interface BillingSettingsFormProps {
  settings: BillingSettings
  onSave: (values: Partial<BillingSettings>) => void
  saved: boolean
}

export function BillingSettingsForm({ settings, onSave, saved }: BillingSettingsFormProps) {
  const [form, setForm] = useState<BillingSettings>(settings)

  const update = <K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Input
          label="Dias de tolerância"
          type="number" min={0} max={60}
          value={form.toleranceDays}
          onChange={(e) => update('toleranceDays', parseInt(e.target.value) || 0)}
        />
        <Select
          label="Política de férias"
          options={[
            { value: 'no_charge', label: 'Não cobrar' },
            { value: 'proportional', label: 'Cobrança proporcional' },
            { value: 'full', label: 'Cobrança integral' },
            { value: 'manual', label: 'Decisão manual' },
          ]}
          value={form.vacationPolicy}
          onChange={(e) => update('vacationPolicy', e.target.value as BillingSettings['vacationPolicy'])}
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-text">Cobrança Automática</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Switch label="Cobrar juros automaticamente" checked={form.autoChargeInterest} onChange={(e) => update('autoChargeInterest', e.target.checked)} />
          <Switch label="Cobrar multa automaticamente" checked={form.autoChargeLateFee} onChange={(e) => update('autoChargeLateFee', e.target.checked)} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-text">Regras</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Switch label="Permitir isenção" checked={form.allowExemption} onChange={(e) => update('allowExemption', e.target.checked)} />
          <Switch label="Pagamento parcial" checked={form.allowPartialPayment} onChange={(e) => update('allowPartialPayment', e.target.checked)} />
          <Switch label="Permitir antecipação" checked={form.allowAnticipation} onChange={(e) => update('allowAnticipation', e.target.checked)} />
          <Switch label="Permitir renegociação" checked={form.allowRenegotiation} onChange={(e) => update('allowRenegotiation', e.target.checked)} />
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
