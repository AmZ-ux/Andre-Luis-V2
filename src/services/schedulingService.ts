import type { ScheduledMessage } from '../types/communication'

const STORAGE_KEY = 'mock_scheduled'

function load(): ScheduledMessage[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function save(items: ScheduledMessage[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function generateId(): string {
  return `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const schedulingService = {
  list(): ScheduledMessage[] {
    return load().sort((a, b) => new Date(`${a.scheduledDate}T${a.scheduledTime}`).getTime() - new Date(`${b.scheduledDate}T${b.scheduledTime}`).getTime())
  },

  getById(id: string): ScheduledMessage | undefined {
    return load().find((s) => s.id === id)
  },

  getByMessageId(messageId: string): ScheduledMessage | undefined {
    return load().find((s) => s.messageId === messageId)
  },

  schedule(messageId: string, date: string, time: string): ScheduledMessage {
    const entry: ScheduledMessage = {
      id: generateId(),
      messageId,
      scheduledDate: date,
      scheduledTime: time,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const items = load()
    items.push(entry)
    save(items)
    return entry
  },

  markAsSent(messageId: string): void {
    const items = load()
    const index = items.findIndex((s) => s.messageId === messageId)
    if (index !== -1) {
      items[index].status = 'sent'
      save(items)
    }
  },

  cancel(scheduleId: string): void {
    const items = load()
    const index = items.findIndex((s) => s.id === scheduleId)
    if (index === -1) throw new Error('Agendamento não encontrado')
    items[index].status = 'cancelled'
    save(items)
  },

  getPendingCount(): number {
    return load().filter((s) => s.status === 'pending').length
  },
}
