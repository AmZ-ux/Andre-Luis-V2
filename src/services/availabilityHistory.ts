import { storage } from './storage'
import type { AvailabilityHistoryEntry, AvailabilityHistoryAction } from '../types/availability'

const HISTORY_KEY = 'mock_availability_history'

function loadHistory(): AvailabilityHistoryEntry[] {
  return storage.get<AvailabilityHistoryEntry[]>(HISTORY_KEY) || []
}

function saveHistory(entries: AvailabilityHistoryEntry[]): void {
  storage.set(HISTORY_KEY, entries)
}

export const availabilityHistory = {
  async add(
    availabilityId: string,
    action: AvailabilityHistoryAction,
    performedBy: string,
    performedById: string,
    notes?: string
  ): Promise<AvailabilityHistoryEntry> {
    const entries = loadHistory()
    const entry: AvailabilityHistoryEntry = {
      id: `ah-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      availabilityId,
      action,
      performedBy,
      performedById,
      notes,
      createdAt: new Date().toLocaleString('pt-BR'),
    }
    entries.unshift(entry)
    saveHistory(entries)
    return entry
  },

  async getByAvailabilityId(availabilityId: string): Promise<AvailabilityHistoryEntry[]> {
    return loadHistory().filter((e) => e.availabilityId === availabilityId)
  },

  async getAll(): Promise<AvailabilityHistoryEntry[]> {
    return loadHistory()
  },
}
