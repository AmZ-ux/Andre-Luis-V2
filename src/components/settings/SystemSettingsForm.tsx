import { useState } from 'react'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Save, RotateCcw } from 'lucide-react'
import type { SystemSettings } from '../../types/settings'

interface SystemSettingsFormProps {
  settings: SystemSettings
  onSave: (values: Partial<SystemSettings>) => void
  saved: boolean
}

export function SystemSettingsForm({ settings, onSave, saved }: SystemSettingsFormProps) {
  const [form, setForm] = useState<SystemSettings>(settings)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Select
          label="Idioma"
          options={[{ value: 'pt-BR', label: 'Português (Brasil)' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]}
          value={form.language}
          onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
        />
        <Select
          label="Fuso horário"
          options={[
            { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
            { value: 'America/Recife', label: 'Recife (GMT-3)' },
            { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
            { value: 'America/Belem', label: 'Belém (GMT-3)' },
            { value: 'America/Porto_Velho', label: 'Porto Velho (GMT-4)' },
          ]}
          value={form.timezone}
          onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
        />
        <Select
          label="Formato de data"
          options={[
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          ]}
          value={form.dateFormat}
          onChange={(e) => setForm((prev) => ({ ...prev, dateFormat: e.target.value }))}
        />
        <Select
          label="Formato de hora"
          options={[
            { value: 'HH:mm', label: '24h (14:30)' },
            { value: 'hh:mm A', label: '12h (02:30 PM)' },
          ]}
          value={form.timeFormat}
          onChange={(e) => setForm((prev) => ({ ...prev, timeFormat: e.target.value }))}
        />
        <Select
          label="Primeiro dia da semana"
          options={[
            { value: '0', label: 'Domingo' },
            { value: '1', label: 'Segunda-feira' },
            { value: '6', label: 'Sábado' },
          ]}
          value={String(form.firstDayOfWeek)}
          onChange={(e) => setForm((prev) => ({ ...prev, firstDayOfWeek: parseInt(e.target.value) as 0 | 1 | 6 }))}
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
