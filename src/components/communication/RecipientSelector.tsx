import { useState } from 'react'
import { motion } from 'framer-motion'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { X, Plus, Users } from 'lucide-react'
import type { Recipient, RecipientFilter, MessageType } from '../../types/communication'

const filterOptions = [
  { value: 'individual', label: 'Individual' },
  { value: 'city', label: 'Cidade' },
  { value: 'institution', label: 'Instituição' },
  { value: 'company', label: 'Empresa' },
  { value: 'transportType', label: 'Tipo de Transporte' },
  { value: 'status', label: 'Status' },
]

interface RecipientSelectorProps {
  selected: Recipient[]
  onChange: (recipients: Recipient[]) => void
  type: MessageType
}

export function RecipientSelector({ selected, onChange, type }: RecipientSelectorProps) {
  const [filterType, setFilterType] = useState<RecipientFilter>('individual')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')

  const handleAdd = () => {
    if (!value.trim() && filterType !== 'all') return
    const labelText = label.trim() || value.trim() || filterType
    const existing = selected.find((r) => r.type === filterType && r.value === value.trim())
    if (existing) return
    onChange([...selected, { type: filterType, value: value.trim() || undefined, label: labelText }])
    setValue('')
    setLabel('')
  }

  const handleRemove = (index: number) => {
    onChange(selected.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium text-text">Destinatários</p>
        {selected.length > 0 && (
          <span className="text-xs text-gray-400">({selected.length} selecionado(s))</span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="flex-1">
          <Select
            options={filterOptions}
            placeholder="Tipo"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as RecipientFilter)}
          />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Valor (ex: São Paulo)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Rótulo (ex: Todos de SP)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <button
          onClick={handleAdd}
          className="h-11 w-11 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-light transition-colors shrink-0"
          aria-label="Adicionar"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {selected.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap gap-2"
        >
          {selected.map((r, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium"
            >
              <Users className="h-3 w-3" />
              {r.label}
              <button onClick={() => handleRemove(i)} className="hover:text-primary-dark transition-colors" aria-label="Remover">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </motion.div>
      )}
    </div>
  )
}
