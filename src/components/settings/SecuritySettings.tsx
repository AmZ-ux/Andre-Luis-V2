import { useState } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Save, RotateCcw } from 'lucide-react'
import type { SecuritySettings } from '../../types/settings'

interface SecuritySettingsFormProps {
  settings: SecuritySettings
  onSave: (values: Partial<SecuritySettings>) => void
  saved: boolean
}

export function SecuritySettingsForm({ settings, onSave, saved }: SecuritySettingsFormProps) {
  const [form, setForm] = useState<SecuritySettings>(settings)

  const update = <K extends keyof SecuritySettings>(key: K, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Input
          label="Tempo de sessão (minutos)"
          type="number" min={5} max={480}
          value={form.sessionTimeoutMinutes}
          onChange={(e) => update('sessionTimeoutMinutes', parseInt(e.target.value) || 30)}
        />
        <Input
          label="Forçar troca de senha (dias)"
          type="number" min={0} max={365}
          value={form.forcePasswordChangeDays}
          onChange={(e) => update('forcePasswordChangeDays', parseInt(e.target.value) || 0)}
        />
        <Input
          label="Máx. tentativas de login"
          type="number" min={1} max={20}
          value={form.maxLoginAttempts}
          onChange={(e) => update('maxLoginAttempts', parseInt(e.target.value) || 5)}
        />
        <Input
          label="Bloqueio automático (minutos)"
          type="number" min={1} max={1440}
          value={form.autoBlockMinutes}
          onChange={(e) => update('autoBlockMinutes', parseInt(e.target.value) || 15)}
        />
        <Input
          label="Retenção de logs (dias)"
          type="number" min={7} max={365}
          value={form.logRetentionDays}
          onChange={(e) => update('logRetentionDays', parseInt(e.target.value) || 90)}
        />
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
