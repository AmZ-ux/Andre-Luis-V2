import { motion } from 'framer-motion'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useState } from 'react'
import { templateService } from '../../services/templateService'
import type { MessageTemplate, TemplateCategory, ChannelType } from '../../types/communication'
import { X, Variable, Save } from 'lucide-react'

const categoryOptions = [
  { value: 'reminder', label: 'Lembrete' },
  { value: 'payment', label: 'Pagamento' },
  { value: 'vacation_return', label: 'Retorno de Férias' },
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'custom', label: 'Personalizado' },
]

const channelOpts = [
  { value: 'app', label: 'Aplicativo' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
]

const KNOWN_VARIABLES = ['nome', 'valor', 'vencimento', 'empresa', 'instituicao', 'cidade', 'tipo_transporte']

interface TemplateEditorProps {
  template?: MessageTemplate
  onSave: (data: { name: string; category: TemplateCategory; subject: string; body: string; channel: ChannelType }) => void
  onClose?: () => void
}

export function TemplateEditor({ template, onSave, onClose }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '')
  const [category, setCategory] = useState<TemplateCategory>(template?.category || 'custom')
  const [subject, setSubject] = useState(template?.subject || '')
  const [body, setBody] = useState(template?.body || '')
  const [channel, setChannel] = useState<ChannelType>(template?.channel || 'app')

  const handleInsertVar = (v: string) => {
    setBody((prev) => prev + `{{${v}}}`)
  }

  const handleSave = () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return
    onSave({ name: name.trim(), category, subject: subject.trim(), body: body.trim(), channel })
  }

  const preview = body ? templateService.render({ ...template, body, variables: [] } as MessageTemplate, {
    nome: 'João Silva',
    valor: 'R$ 150,00',
    vencimento: '15/07/2026',
    empresa: 'Empresa ABC',
    instituicao: 'Universidade XYZ',
    cidade: 'São Paulo',
    tipo_transporte: 'Universitário',
  }) : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onClose && (
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors" aria-label="Fechar">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
          <h3 className="text-base font-semibold text-text">
            {template ? 'Editar Modelo' : 'Novo Modelo'}
          </h3>
        </div>
        <Button size="sm" icon={<Save className="h-4 w-4" />} onClick={handleSave}>
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder="Nome do modelo" value={name} onChange={(e) => setName(e.target.value)} />
        <Select options={categoryOptions} placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Select options={channelOpts} placeholder="Canal" value={channel} onChange={(e) => setChannel(e.target.value as ChannelType)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-text">Mensagem</label>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">Variáveis:</span>
            {KNOWN_VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => handleInsertVar(v)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Variable className="h-2.5 w-2.5" />
                {v}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Digite o modelo da mensagem... Use {{variavel}} para campos dinâmicos"
          rows={5}
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 resize-y"
        />
      </div>

      {preview && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-medium text-gray-500 mb-2">Pré-visualização:</p>
          <p className="text-sm text-text">{preview}</p>
        </div>
      )}
    </motion.div>
  )
}
