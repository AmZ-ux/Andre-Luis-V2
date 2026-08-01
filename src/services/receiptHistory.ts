import { storage } from './storage'
import type { ReceiptHistoryEntry, ReceiptHistoryAction } from '../types/receipt'

const HISTORY_KEY = 'mock_receipt_history'

function loadHistory(): ReceiptHistoryEntry[] {
  return storage.get<ReceiptHistoryEntry[]>(HISTORY_KEY) || []
}

function saveHistory(entries: ReceiptHistoryEntry[]): void {
  storage.set(HISTORY_KEY, entries)
}

export const receiptHistory = {
  async add(
    receiptId: string,
    action: ReceiptHistoryAction,
    performedBy: string,
    performedById: string,
    notes?: string
  ): Promise<ReceiptHistoryEntry> {
    const entries = loadHistory()
    const entry: ReceiptHistoryEntry = {
      id: `rh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      receiptId,
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

  async getByReceiptId(receiptId: string): Promise<ReceiptHistoryEntry[]> {
    const entries = loadHistory()
    return entries.filter((e) => e.receiptId === receiptId)
  },

  async getAll(): Promise<ReceiptHistoryEntry[]> {
    return loadHistory()
  },
}
