import { useState, useEffect, useCallback } from 'react'
import { communicationService } from '../services/communicationService'
import { templateService } from '../services/templateService'
import { notificationService } from '../services/notificationService'
import { channelService } from '../services/channelService'
import { schedulingService } from '../services/schedulingService'
import { messageHistoryService } from '../services/messageHistoryService'
import type {
  CommunicationMessage, CommunicationSummary, MessageTemplate, Channel,
  Notification, NotificationPreferences, ScheduledMessage, HistoryEntry,
  MessageType, ChannelType, Recipient, TemplateCategory, CommunicationFilters,
} from '../types/communication'

export function useCommunication() {
  const [messages, setMessages] = useState<CommunicationMessage[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [summary, setSummary] = useState<CommunicationSummary>({ sent: 0, pending: 0, scheduled: 0, failed: 0, total: 0 })
  const [preferences, setPreferences] = useState<NotificationPreferences>(notificationService.getPreferences())
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<CommunicationFilters>({ period: 'all', type: '', channel: '', status: '', search: '' })
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(() => {
    setError(null)
    setLoading(true)
    try {
      setMessages(communicationService.list())
      setTemplates(templateService.list())
      setChannels(channelService.list())
      setNotifications(notificationService.list())
      setScheduled(schedulingService.list())
      setHistory(messageHistoryService.list())
      setSummary(communicationService.getSummary())
      setUnreadCount(notificationService.getUnreadCount())
      setPreferences(notificationService.getPreferences())
    } catch {
      setError('Erro ao carregar dados de comunicação')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const sendMessage = useCallback((data: {
    title: string; subject: string; body: string; type: MessageType; channel: ChannelType;
    recipients: Recipient[]; templateId?: string; scheduledAt?: string;
  }) => {
    const msg = communicationService.create(data)
    messageHistoryService.add({ messageId: msg.id, action: data.scheduledAt ? 'scheduled' : 'sent', description: `Mensagem ${data.scheduledAt ? 'agendada' : 'enviada'}: ${data.title}` })
    loadAll()
    return msg
  }, [loadAll])

  const createTemplate = useCallback((data: { name: string; category: TemplateCategory; subject: string; body: string; channel: ChannelType }) => {
    const tpl = templateService.create(data)
    loadAll()
    return tpl
  }, [loadAll])

  const updateTemplate = useCallback((id: string, data: Partial<{ name: string; category: TemplateCategory; subject: string; body: string; channel: ChannelType }>) => {
    const tpl = templateService.update(id, data)
    loadAll()
    return tpl
  }, [loadAll])

  const deleteTemplate = useCallback((id: string) => {
    templateService.delete(id)
    loadAll()
  }, [loadAll])

  const scheduleMessage = useCallback((messageId: string, date: string, time: string) => {
    const entry = schedulingService.schedule(messageId, date, time)
    communicationService.updateStatus(messageId, 'scheduled')
    messageHistoryService.add({ messageId, action: 'scheduled', description: `Agendado para ${date} às ${time}` })
    loadAll()
    return entry
  }, [loadAll])

  const cancelScheduling = useCallback((scheduleId: string, messageId: string) => {
    schedulingService.cancel(scheduleId)
    communicationService.updateStatus(messageId, 'draft')
    messageHistoryService.add({ messageId, action: 'cancelled', description: 'Agendamento cancelado' })
    loadAll()
  }, [loadAll])

  const markNotifRead = useCallback((id: string) => {
    notificationService.markAsRead(id)
    loadAll()
  }, [loadAll])

  const markNotifFavorite = useCallback((id: string) => {
    notificationService.markAsFavorite(id)
    loadAll()
  }, [loadAll])

  const archiveNotif = useCallback((id: string) => {
    notificationService.archive(id)
    loadAll()
  }, [loadAll])

  const markAllNotifsRead = useCallback(() => {
    notificationService.markAllAsRead()
    loadAll()
  }, [loadAll])

  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    const updated = notificationService.updatePreferences(prefs)
    setPreferences(updated)
  }, [])

  const toggleChannel = useCallback((type: ChannelType, enabled: boolean) => {
    channelService.toggleEnabled(type, enabled)
    loadAll()
  }, [loadAll])

  return {
    messages, templates, channels, notifications, scheduled, history,
    summary, preferences, unreadCount, loading, filters, error,
    sendMessage, createTemplate, updateTemplate, deleteTemplate,
    scheduleMessage, cancelScheduling,
    markNotifRead, markNotifFavorite, archiveNotif, markAllNotifsRead,
    updatePreferences, toggleChannel,
    setFilters, reload: loadAll,
  }
}
