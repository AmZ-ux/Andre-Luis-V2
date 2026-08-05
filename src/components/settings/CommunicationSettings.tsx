import { useState } from 'react'
import { Select } from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Save, RotateCcw } from 'lucide-react'
import type { CommunicationSettings } from '../../types/settings'

interface CommunicationSettingsFormProps {
  settings: CommunicationSettings
  onSave: (values: Partial<CommunicationSettings>) => void
  saved: boolean
}

export function CommunicationSettingsForm({ settings, onSave, saved }: CommunicationSettingsFormProps) {
  const [form, setForm] = useState<CommunicationSettings>(settings)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Idioma"
          options={[{ value: 'pt-BR', label: 'Português (Brasil)' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]}
          value={form.language}
          onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
        />
      </div>
      <div className="space-y-3">
        <Switch label="Mensagens automáticas" checked={form.autoMessages} onChange={(e) => setForm((prev) => ({ ...prev, autoMessages: e.target.checked }))} />
        <Switch label="Usar templates padrão" checked={form.defaultTemplates} onChange={(e) => setForm((prev) => ({ ...prev, defaultTemplates: e.target.checked }))} />
      </div>
      <Textarea
        label="Assinatura das mensagens"
        value={form.signature}
        onChange={(e) => setForm((prev) => ({ ...prev, signature: e.target.value }))}
        rows={3}
      />
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
