import type { HistoryEntry } from '../types/communication'

const STORAGE_KEY = 'mock_message_history'

function load(): HistoryEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function save(entries: HistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function generateId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const messageHistoryService = {
  list(messageId?: string): HistoryEntry[] {
    const entries = load()
    const filtered = messageId ? entries.filter((e) => e.messageId === messageId) : entries
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  },

  add(data: {
    messageId: string
    action: HistoryEntry['action']
    description: string
    performedBy?: string
  }): HistoryEntry {
    const entry: HistoryEntry = {
      id: generateId(),
      messageId: data.messageId,
      action: data.action,
      description: data.description,
      performedBy: data.performedBy || 'admin',
      timestamp: new Date().toISOString(),
    }
    const entries = load()
    entries.unshift(entry)
    save(entries)
    return entry
  },

  getByAction(action: HistoryEntry['action']): HistoryEntry[] {
    return load().filter((e) => e.action === action)
  },

  clear(): void {
    save([])
  },
}
