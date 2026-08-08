import { useState, useEffect, useCallback } from 'react'
import { config } from '../config'
import { communicationService } from '../services/communicationService'
import { templateService } from '../services/templateService'
import { notificationService } from '../services/notificationService'
import { channelService } from '../services/channelService'
import { schedulingService } from '../services/schedulingService'
import { messageHistoryService } from '../services/messageHistoryService'
import { realCommunication } from '../services/realApi'
import type {
  CommunicationMessage, CommunicationSummary, MessageTemplate, Channel,
  Notification, NotificationPreferences, ScheduledMessage, HistoryEntry,
  MessageType, ChannelType, Recipient, TemplateCategory, CommunicationFilters,
} from '../types/communication'

function parseRecipients(raw: string | Recipient[] | null): Recipient[] {
  if (Array.isArray(raw)) return raw
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    return (list as any[]).map((r) => {
      if (typeof r === 'string') return { type: 'individual', value: r, label: r }
      return {
        type: r.type || 'individual',
        value: r.value ?? r.id ?? '',
        label: r.label || r.name || r.value || '',
      }
    })
  } catch {
    return []
  }
}

function parseJsonList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function toMessage(row: any): CommunicationMessage {
  return {
    id: row.id,
    title: row.title || '',
    subject: row.subject || '',
    body: row.body || '',
    type: row.type || 'individual',
    status: row.status || 'draft',
    priority: row.priority || 'normal',
    channel: row.channel || 'app',
    templateId: row.templateId || undefined,
    recipients: parseRecipients(row.recipients),
    scheduledAt: row.scheduledAt || undefined,
    sentAt: row.sentAt || undefined,
    failedAt: undefined,
    errorMessage: undefined,
    createdBy: row.createdBy || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || row.createdAt || '',
  }
}

function toTemplate(row: any): MessageTemplate {
  return {
    id: row.id,
    name: row.name || '',
    category: row.category || 'custom',
    subject: row.subject || '',
    body: row.body || '',
    variables: parseJsonList(row.variables),
    channel: row.channel || 'app',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || row.createdAt || '',
  }
}

function toNotification(row: any): Notification {
  return {
    id: row.id,
    title: row.title || '',
    message: row.message || '',
    status: row.status || 'unread',
    type: row.type || 'info',
    link: row.link || undefined,
    createdAt: row.createdAt || '',
    readAt: row.readAt || undefined,
  }
}

function toScheduled(row: any): ScheduledMessage {
  return {
    id: row.id,
    messageId: row.messageId || row.id,
    scheduledDate: row.scheduledDate || '',
    scheduledTime: row.scheduledTime || '',
    status: row.status === 'sent' || row.status === 'cancelled' ? row.status : 'pending',
    createdAt: row.createdAt || '',
  }
}

function computeSummary(messages: CommunicationMessage[]): CommunicationSummary {
  const count = (s: string) => messages.filter((m) => m.status === s).length
  const last = messages.find((m) => m.status === 'sent')
  return {
    sent: count('sent'),
    pending: count('draft'),
    scheduled: count('scheduled'),
    failed: count('failed'),
    total: messages.length,
    lastCommunication: last?.sentAt || last?.createdAt || undefined,
  }
}

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
  const [loading, setLoading] = useState(config.realApi)
  const [filters, setFilters] = useState<CommunicationFilters>({ period: 'all', type: '', channel: '', status: '', search: '' })
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setError(null)

    if (!config.realApi) {
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
      return
    }

    try {
      const [msgRes, tplRes, chRes, notifRes, schedRes, unreadRes, prefsRes] = await Promise.all([
        realCommunication.list(),
        realCommunication.templates(),
        realCommunication.channels(),
        realCommunication.notifications(),
        realCommunication.schedules(),
        realCommunication.unreadCount(),
        realCommunication.getPreferences(),
      ])
      const msgList = msgRes.map(toMessage)
      setMessages(msgList)
      setTemplates(tplRes.map(toTemplate))
      setChannels(chRes)
      setNotifications(notifRes.map(toNotification))
      setScheduled(schedRes.map(toScheduled))
      setHistory([])
      setSummary(computeSummary(msgList))
      setUnreadCount(unreadRes.count ?? 0)
      if (prefsRes?.prefs) setPreferences({ ...notificationService.getPreferences(), ...prefsRes.prefs })
      if (prefsRes?.channelEnabled) {
        setChannels((prev) => prev.map((c) => ({ ...c, enabled: prefsRes.channelEnabled[c.type] ?? c.enabled })))
      }
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
    if (!config.realApi) {
      const msg = communicationService.create(data)
      messageHistoryService.add({ messageId: msg.id, action: data.scheduledAt ? 'scheduled' : 'sent', description: `Mensagem ${data.scheduledAt ? 'agendada' : 'enviada'}: ${data.title}` })
      loadAll()
      return msg
    }

    realCommunication.create({
      title: data.title,
      subject: data.subject || '',
      body: data.body,
      type: data.type,
      channel: data.channel,
      recipients: data.recipients,
      scheduledAt: data.scheduledAt || undefined,
      templateId: data.templateId || undefined,
    }).then(() => loadAll()).catch(() => {})
    return undefined
  }, [loadAll])

  const createTemplate = useCallback((data: { name: string; category: TemplateCategory; subject: string; body: string; channel: ChannelType }) => {
    if (!config.realApi) {
      const tpl = templateService.create(data)
      loadAll()
      return tpl
    }

    realCommunication.createTemplate(data).then(() => loadAll()).catch(() => {})
    return undefined
  }, [loadAll])

  const updateTemplate = useCallback((id: string, data: Partial<{ name: string; category: TemplateCategory; subject: string; body: string; channel: ChannelType }>) => {
    if (!config.realApi) {
      const tpl = templateService.update(id, data)
      loadAll()
      return tpl
    }

    realCommunication.updateTemplate(id, data).then(() => loadAll()).catch(() => {})
    return undefined
  }, [loadAll])

  const deleteTemplate = useCallback((id: string) => {
    if (!config.realApi) {
      templateService.delete(id)
      loadAll()
      return
    }

    realCommunication.deleteTemplate(id).then(() => loadAll()).catch(() => {})
  }, [loadAll])

  const scheduleMessage = useCallback((messageId: string, date: string, time: string) => {
    if (!config.realApi) {
      const entry = schedulingService.schedule(messageId, date, time)
      communicationService.updateStatus(messageId, 'scheduled')
      messageHistoryService.add({ messageId, action: 'scheduled', description: `Agendado para ${date} às ${time}` })
      loadAll()
      return entry
    }

    realCommunication.schedule(messageId, date, time).then(() => loadAll()).catch(() => {})
    return undefined
  }, [loadAll])

  const cancelScheduling = useCallback((_scheduleId: string, messageId: string) => {
    if (!config.realApi) {
      schedulingService.cancel(_scheduleId)
      communicationService.updateStatus(messageId, 'draft')
      messageHistoryService.add({ messageId, action: 'cancelled', description: 'Agendamento cancelado' })
      loadAll()
      return
    }

    realCommunication.updateStatus(messageId, 'draft').then(() => loadAll()).catch(() => {})
  }, [loadAll])

  const markNotifRead = useCallback((id: string) => {
    if (!config.realApi) {
      notificationService.markAsRead(id)
      loadAll()
      return
    }

    realCommunication.updateNotification(id, 'read').then(() => loadAll()).catch(() => {})
  }, [loadAll])

  const markNotifFavorite = useCallback((id: string) => {
    if (!config.realApi) {
      notificationService.markAsFavorite(id)
      loadAll()
      return
    }

    realCommunication.updateNotification(id, 'favorite').then(() => loadAll()).catch(() => {})
  }, [loadAll])

  const archiveNotif = useCallback((id: string) => {
    if (!config.realApi) {
      notificationService.archive(id)
      loadAll()
      return
    }

    realCommunication.updateNotification(id, 'archived').then(() => loadAll()).catch(() => {})
  }, [loadAll])

  const markAllNotifsRead = useCallback(() => {
    if (!config.realApi) {
      notificationService.markAllAsRead()
      loadAll()
      return
    }

    realCommunication.markAllNotificationsRead().then(() => loadAll()).catch(() => {})
  }, [loadAll])

  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    const updated = notificationService.updatePreferences(prefs)
    setPreferences(updated)
    if (config.realApi) {
      realCommunication.updatePreferences({ prefs: updated }).catch(() => {})
    }
  }, [])

  const toggleChannel = useCallback((type: ChannelType, enabled: boolean) => {
    channelService.toggleEnabled(type, enabled)
    loadAll()
    if (config.realApi) {
      realCommunication.updatePreferences({ channelEnabled: { [type]: enabled } }).catch(() => {})
    }
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
