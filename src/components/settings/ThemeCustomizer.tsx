import { useState } from 'react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Save, RotateCcw } from 'lucide-react'
import type { AppearanceSettings } from '../../types/settings'

interface ThemeCustomizerProps {
  settings: AppearanceSettings
  onSave: (values: Partial<AppearanceSettings>) => void
  saved: boolean
}

export function ThemeCustomizer({ settings, onSave, saved }: ThemeCustomizerProps) {
  const [form, setForm] = useState<AppearanceSettings>(settings)

  const update = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Nome do sistema"
          value={form.systemName}
          onChange={(e) => update('systemName', e.target.value)}
        />
        <Select
          label="Tema"
          options={[
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
            { value: 'system', label: 'Sistema' },
          ]}
          value={form.theme}
          onChange={(e) => update('theme', e.target.value as AppearanceSettings['theme'])}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Cor principal</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => update('primaryColor', e.target.value)}
              className="h-11 w-14 rounded-xl border border-gray-300 dark:border-gray-600 bg-white cursor-pointer"
            />
            <input
              type="text"
              value={form.primaryColor}
              onChange={(e) => update('primaryColor', e.target.value)}
              className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Cor secundária</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.secondaryColor}
              onChange={(e) => update('secondaryColor', e.target.value)}
              className="h-11 w-14 rounded-xl border border-gray-300 dark:border-gray-600 bg-white cursor-pointer"
            />
            <input
              type="text"
              value={form.secondaryColor}
              onChange={(e) => update('secondaryColor', e.target.value)}
              className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
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
