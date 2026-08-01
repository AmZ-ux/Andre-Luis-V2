import { channelService } from './channelService'
import type { CommunicationMessage, MessageStatus, MessageType, ChannelType, Recipient } from '../types/communication'

const STORAGE_KEY = 'mock_messages'

function load(): CommunicationMessage[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function save(messages: CommunicationMessage[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

export const communicationService = {
  list(filters?: { type?: string; status?: string; channel?: string; search?: string }): CommunicationMessage[] {
    let messages = load()
    if (filters?.type) messages = messages.filter((m) => m.type === filters.type)
    if (filters?.status) messages = messages.filter((m) => m.status === filters.status)
    if (filters?.channel) messages = messages.filter((m) => m.channel === filters.channel)
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      messages = messages.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q)
      )
    }
    return messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  getById(id: string): CommunicationMessage | undefined {
    return load().find((m) => m.id === id)
  },

  create(data: {
    title: string
    subject: string
    body: string
    type: MessageType
    channel: ChannelType
    recipients: Recipient[]
    templateId?: string
    scheduledAt?: string
  }): CommunicationMessage {
    const channel = channelService.getByType(data.channel)
    const message: CommunicationMessage = {
      id: generateId(),
      title: data.title,
      subject: data.subject,
      body: data.body,
      type: data.type,
      status: data.scheduledAt ? 'scheduled' : 'sent',
      priority: 'normal',
      channel: data.channel,
      templateId: data.templateId,
      recipients: data.recipients,
      scheduledAt: data.scheduledAt,
      sentAt: data.scheduledAt ? undefined : formatTimestamp(),
      createdBy: 'admin',
      createdAt: formatTimestamp(),
      updatedAt: formatTimestamp(),
    }

    if (message.status === 'sent' && (!channel || !channel.enabled)) {
      message.status = 'failed'
      message.errorMessage = `Canal ${data.channel} não disponível`
      message.failedAt = formatTimestamp()
    }

    const messages = load()
    messages.push(message)
    save(messages)
    return message
  },

  updateStatus(id: string, status: MessageStatus, errorMessage?: string): CommunicationMessage {
    const messages = load()
    const index = messages.findIndex((m) => m.id === id)
    if (index === -1) throw new Error('Mensagem não encontrada')
    messages[index].status = status
    messages[index].updatedAt = formatTimestamp()
    if (status === 'sent') messages[index].sentAt = formatTimestamp()
    if (status === 'failed') {
      messages[index].failedAt = formatTimestamp()
      messages[index].errorMessage = errorMessage
    }
    if (status === 'cancelled') messages[index].scheduledAt = undefined
    save(messages)
    return messages[index]
  },

  delete(id: string): void {
    save(load().filter((m) => m.id !== id))
  },

  getSummary(): { sent: number; pending: number; scheduled: number; failed: number; total: number; lastCommunication?: string } {
    const messages = load()
    const sentMessages = messages.filter((m) => m.sentAt)
    const lastComm = sentMessages.length > 0
      ? sentMessages.sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime())[0].sentAt
      : undefined
    return {
      sent: messages.filter((m) => m.status === 'sent').length,
      pending: messages.filter((m) => m.status === 'draft').length,
      scheduled: messages.filter((m) => m.status === 'scheduled').length,
      failed: messages.filter((m) => m.status === 'failed').length,
      total: messages.length,
      lastCommunication: lastComm,
    }
  },
}
