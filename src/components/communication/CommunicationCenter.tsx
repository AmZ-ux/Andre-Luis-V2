import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import { Grid } from '../ui/Grid'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { SkeletonCard } from '../ui/Skeleton'
import { CommunicationFilters } from './CommunicationFilters'
import { CommunicationHistory } from './CommunicationHistory'
import { ChannelStatus } from './ChannelStatus'
import { PreferencesPanel } from './PreferencesPanel'
import { NotificationPanel } from './NotificationPanel'
import { TemplateEditor } from './TemplateEditor'
import { TemplateCard } from './TemplateCard'
import { MessageCard } from './MessageCard'
import { MessageComposer } from './MessageComposer'
import { useCommunication } from '../../hooks/useCommunication'
import {
  Send, FileText, Clock, History, Bell, MessageSquare, Settings,
  BarChart3, Plus, Smartphone, AlertTriangle,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import type { MessageTemplate } from '../../types/communication'

const tabs = [
  { key: 'overview', label: 'Resumo', icon: BarChart3 },
  { key: 'messages', label: 'Mensagens', icon: MessageSquare },
  { key: 'templates', label: 'Modelos', icon: FileText },
  { key: 'history', label: 'Histórico', icon: History },
  { key: 'notifications', label: 'Notificações', icon: Bell },
  { key: 'channels', label: 'Canais', icon: Smartphone },
  { key: 'preferences', label: 'Preferências', icon: Settings },
]

export function CommunicationCenter({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [showComposer, setShowComposer] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | undefined>()
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)

  const {
    messages, templates, channels, notifications, scheduled, history,
    summary, preferences, unreadCount, loading,
    sendMessage, createTemplate, updateTemplate, deleteTemplate,
    scheduleMessage, cancelScheduling,
    markNotifRead, markNotifFavorite, archiveNotif, markAllNotifsRead,
    updatePreferences, toggleChannel,
    filters, setFilters, reload,
  } = useCommunication()

  const handleSend = (data: Parameters<typeof sendMessage>[0]) => {
    sendMessage(data)
    setShowComposer(false)
  }

  const handleSaveTemplate = (data: Parameters<typeof createTemplate>[0]) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, data)
    } else {
      createTemplate(data)
    }
    setEditingTemplate(undefined)
    setShowTemplateEditor(false)
  }

  const handleEditTemplate = (tpl: MessageTemplate) => {
    setEditingTemplate(tpl)
    setShowTemplateEditor(true)
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {!embedded && (
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">Central de Comunicação</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie mensagens, notificações e comunicações do sistema</p>
          </div>
        )}
        <div className={embedded ? 'flex gap-2 ml-auto' : 'flex gap-2'}>
          {activeTab === 'messages' && (
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowComposer(true)}>
              Nova Mensagem
            </Button>
          )}
          {activeTab === 'templates' && (
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditingTemplate(undefined); setShowTemplateEditor(true) }}>
              Novo Modelo
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200',
                isActive ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.key === 'notifications' && unreadCount > 0 && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-error text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Grid cols={{ default: 2, sm: 4 }} gap={4}>
            <SummaryCard icon={Send} label="Enviadas" value={summary.sent} color="text-success" bg="bg-success/10" />
            <SummaryCard icon={Clock} label="Agendadas" value={summary.scheduled} color="text-warning" bg="bg-warning/10" />
            <SummaryCard icon={AlertTriangle} label="Com erro" value={summary.failed} color="text-error" bg="bg-error/10" />
            <SummaryCard icon={MessageSquare} label="Total" value={summary.total} color="text-primary" bg="bg-primary/10" />
          </Grid>
          {summary.lastCommunication && (
            <p className="text-xs text-gray-400 text-center sm:text-left">
              Última comunicação: {new Date(summary.lastCommunication).toLocaleString('pt-BR')}
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text">Canais</h3>
              </div>
              <ChannelStatus channels={channels} onToggle={toggleChannel} />
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text">Agendamentos</h3>
                {scheduled.filter((s) => s.status === 'pending').length > 0 && (
                  <Badge variant="warning">{scheduled.filter((s) => s.status === 'pending').length} pendente(s)</Badge>
                )}
              </div>
              {scheduled.filter((s) => s.status === 'pending').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Clock className="h-6 w-6 text-gray-300" />
                  <p className="text-xs text-gray-400">Nenhum agendamento pendente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduled.filter((s) => s.status === 'pending').slice(0, 5).map((s) => {
                    const msg = messages.find((m) => m.id === s.messageId)
                    return (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text truncate">{msg?.title || 'Mensagem'}</p>
                          <p className="text-[10px] text-gray-500">{s.scheduledDate} às {s.scheduledTime}</p>
                        </div>
                        <button
                          onClick={() => cancelScheduling(s.id, s.messageId)}
                          className="text-[10px] text-error hover:text-error-dark transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <NotificationPanel
              notifications={notifications.filter((n) => n.status === 'unread').slice(0, 5)}
              unreadCount={unreadCount}
              onMarkRead={markNotifRead}
              onMarkFavorite={markNotifFavorite}
              onArchive={archiveNotif}
              onMarkAllRead={markAllNotifsRead}
            />
          </Card>
        </motion.div>
      )}

      {activeTab === 'messages' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {showComposer ? (
            <Card>
              <MessageComposer onSend={handleSend} onClose={() => setShowComposer(false)} />
            </Card>
          ) : (
            <>
              <CommunicationFilters filters={filters} onChange={setFilters} />

              {loading ? (
                <Grid cols={{ default: 1, sm: 2, lg: 3 }} gap={4}>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </Grid>
              ) : messages.length === 0 ? (
                <Card>
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <MessageSquare className="h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">Nenhuma mensagem encontrada</p>
                    <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowComposer(true)}>
                      Criar primeira mensagem
                    </Button>
                  </div>
                </Card>
              ) : (
                <Grid cols={{ default: 1, sm: 2, lg: 3 }} gap={4}>
                  {messages.map((msg) => (
                    <MessageCard key={msg.id} message={msg} />
                  ))}
                </Grid>
              )}
            </>
          )}
        </motion.div>
      )}

      {activeTab === 'templates' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {showTemplateEditor ? (
            <Card>
              <TemplateEditor
                template={editingTemplate}
                onSave={handleSaveTemplate}
                onClose={() => { setEditingTemplate(undefined); setShowTemplateEditor(false) }}
              />
            </Card>
          ) : (
            <>
              {templates.length === 0 ? (
                <Card>
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <FileText className="h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">Nenhum modelo criado</p>
                    <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowTemplateEditor(true)}>
                      Criar primeiro modelo
                    </Button>
                  </div>
                </Card>
              ) : (
                <Grid cols={{ default: 1, sm: 2, lg: 3 }} gap={4}>
                  {templates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      onEdit={handleEditTemplate}
                      onDelete={deleteTemplate}
                    />
                  ))}
                </Grid>
              )}
            </>
          )}
        </motion.div>
      )}

      {activeTab === 'history' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-text">Histórico de Comunicações</h3>
              <p className="text-xs text-gray-500 mt-0.5">Registro de todas as ações realizadas na central</p>
            </div>
            <CommunicationHistory />
          </Card>
        </motion.div>
      )}

      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <NotificationPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={markNotifRead}
              onMarkFavorite={markNotifFavorite}
              onArchive={archiveNotif}
              onMarkAllRead={markAllNotifsRead}
            />
          </Card>
        </motion.div>
      )}

      {activeTab === 'channels' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-text">Canais de Comunicação</h3>
              <p className="text-xs text-gray-500 mt-0.5">Configure os canais disponíveis para envio de mensagens</p>
            </div>
            <ChannelStatus channels={channels} onToggle={toggleChannel} />
          </Card>
        </motion.div>
      )}

      {activeTab === 'preferences' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <PreferencesPanel preferences={preferences} onUpdate={updatePreferences} />
          </Card>
        </motion.div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon, label, value, color, bg,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <div className={`h-8 w-8 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <p className="text-xl font-bold text-text">{value}</p>
    </motion.div>
  )
}
