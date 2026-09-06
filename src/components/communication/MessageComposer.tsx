import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { TemplateSelector } from './TemplateSelector'
import { RecipientSelector } from './RecipientSelector'
import { ScheduleModal } from './ScheduleModal'
import { Send, Clock, FileText, X, ArrowLeft } from 'lucide-react'
import { templateService } from '../../services/templateService'
import type { MessageType, ChannelType, Recipient } from '../../types/communication'

const messageTypeOptions = [
  { value: 'individual', label: 'Individual' },
  { value: 'group', label: 'Em grupo' },
  { value: 'all', label: 'Para todos' },
]

const channelOptions = [
  { value: 'app', label: 'Aplicativo' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
]

interface MessageComposerProps {
  onSend?: (data: {
    title: string; subject: string; body: string; type: MessageType; channel: ChannelType;
    recipients: Recipient[]; templateId?: string; scheduledAt?: string;
  }) => void
  onClose?: () => void
}

export function MessageComposer({ onSend, onClose }: MessageComposerProps) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<MessageType>('individual')
  const [channel, setChannel] = useState<ChannelType>('app')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [templateId, setTemplateId] = useState<string | undefined>()
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDateTime, setScheduleDateTime] = useState<{ date: string; time: string } | null>(null)

  const handleTemplateSelect = (tplId: string) => {
    const tpl = templateService.getById(tplId)
    if (tpl) {
      setSubject(tpl.subject)
      setBody(tpl.body)
      setTemplateId(tpl.id)
      setTitle(tpl.name)
    }
    setShowTemplateSelector(false)
  }

  const handleSchedule = (date: string, time: string) => {
    setScheduleDateTime({ date, time })
    setShowScheduleModal(false)
  }

  const handleSend = () => {
    if (!title.trim() || !body.trim()) return
    if (type !== 'all' && recipients.length === 0) return
    onSend?.({
      title: title.trim(),
      subject: subject.trim() || title.trim(),
      body: body.trim(),
      type,
      channel,
      recipients: type === 'all' ? [] : recipients,
      templateId,
      scheduledAt: scheduleDateTime ? `${scheduleDateTime.date}T${scheduleDateTime.time}` : undefined,
    })
    setTitle('')
    setSubject('')
    setBody('')
    setRecipients([])
    setTemplateId(undefined)
    setScheduleDateTime(null)
    onClose?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {onClose && (
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors shrink-0" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </button>
          )}
          <h3 className="text-base font-semibold text-text truncate">Nova Mensagem</h3>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="ghost" size="sm" icon={<Clock className="h-4 w-4" />} onClick={() => setShowScheduleModal(true)} className="min-w-0">
            {scheduleDateTime ? `${scheduleDateTime.date} ${scheduleDateTime.time}` : 'Agendar'}
          </Button>
          <Button size="sm" icon={<Send className="h-4 w-4" />} onClick={handleSend}>
            {scheduleDateTime ? 'Agendar' : 'Enviar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          options={messageTypeOptions}
          placeholder="Tipo de mensagem"
          value={type}
          onChange={(e) => setType(e.target.value as MessageType)}
        />
        <Select
          options={channelOptions}
          placeholder="Canal"
          value={channel}
          onChange={(e) => setChannel(e.target.value as ChannelType)}
        />
      </div>

      <Input
        placeholder="Título da mensagem"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        placeholder="Assunto"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-text">Mensagem</label>
          <Button variant="ghost" size="sm" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => setShowTemplateSelector(!showTemplateSelector)}>
            Usar modelo
          </Button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Digite sua mensagem... Use {{variavel}} para campos dinâmicos"
          rows={5}
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 resize-y"
        />
      </div>

      {showTemplateSelector && (
        <TemplateSelector onSelect={handleTemplateSelect} onClose={() => setShowTemplateSelector(false)} />
      )}

      {type !== 'all' && (
        <RecipientSelector
          selected={recipients}
          onChange={setRecipients}
          type={type}
        />
      )}

      {scheduleDateTime && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 px-3 py-2 rounded-lg">
          <Clock className="h-3.5 w-3.5" />
          Agendado para {scheduleDateTime.date} às {scheduleDateTime.time}
          <button onClick={() => setScheduleDateTime(null)} className="ml-auto hover:text-warning-dark transition-colors" aria-label="Remover agendamento">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ScheduleModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleSchedule}
      />
    </motion.div>
  )
}
