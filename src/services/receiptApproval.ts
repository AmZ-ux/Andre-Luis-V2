import { receiptHistory } from './receiptHistory'
import { monthlyFeeService } from './monthlyFeeService'
import { receiptService } from './receiptService'
import { config } from '../config'
import { realReceipts } from './realApi'
import type { Receipt } from '../types/receipt'

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export const receiptApproval = {
  async approve(
    receiptId: string,
    adminName: string,
    adminId: string,
    notes?: string
  ): Promise<Receipt> {
    if (config.realApi) {
      return realReceipts.approve(receiptId, {
        notes: notes || '',
        approvedBy: adminName,
        approvedById: adminId,
      })
    }
    await delay(300)
    const receipt = await receiptService.getById(receiptId)
    if (!receipt) throw new Error('Comprovante não encontrado')
    if (receipt.status !== 'awaiting') throw new Error('Comprovante não está aguardando análise')

    const updated = await receiptService.update(receiptId, {
      status: 'approved',
      reviewedBy: adminName,
      reviewDate: new Date().toLocaleDateString('pt-BR'),
      reviewNotes: notes || '',
    })

    await monthlyFeeService.update(receipt.monthlyFeeId, {
      status: 'paid',
    })

    await receiptHistory.add(receiptId, 'approved', adminName, adminId, notes)

    return updated
  },

  async reject(
    receiptId: string,
    adminName: string,
    adminId: string,
    reason: string
  ): Promise<Receipt> {
    if (config.realApi) {
      return realReceipts.reject(receiptId, reason)
    }
    await delay(300)
    const receipt = await receiptService.getById(receiptId)
    if (!receipt) throw new Error('Comprovante não encontrado')
    if (receipt.status !== 'awaiting') throw new Error('Comprovante não está aguardando análise')

    if (!reason.trim()) throw new Error('Motivo da rejeição é obrigatório')

    const updated = await receiptService.update(receiptId, {
      status: 'rejected',
      reviewedBy: adminName,
      reviewDate: new Date().toLocaleDateString('pt-BR'),
      reviewNotes: reason,
    })

    await receiptHistory.add(receiptId, 'rejected', adminName, adminId, reason)

    return updated
  },

  async cancelReview(
    receiptId: string,
    adminName: string,
    adminId: string,
    reason?: string
  ): Promise<Receipt> {
    if (config.realApi) {
      return realReceipts.cancel(receiptId, reason || '')
    }
    await delay(300)
    const receipt = await receiptService.getById(receiptId)
    if (!receipt) throw new Error('Comprovante não encontrado')
    if (receipt.status !== 'awaiting') throw new Error('Comprovante não está aguardando análise')

    const updated = await receiptService.update(receiptId, {
      status: 'cancelled',
      reviewedBy: adminName,
      reviewDate: new Date().toLocaleDateString('pt-BR'),
      reviewNotes: reason || '',
    })

    await receiptHistory.add(receiptId, 'cancelled_analysis', adminName, adminId, reason)

    return updated
  },

  async markViewed(receiptId: string, adminName: string, adminId: string): Promise<void> {
    await receiptHistory.add(receiptId, 'viewed', adminName, adminId)
  },
}
