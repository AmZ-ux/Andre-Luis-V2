import { describe, it, expect } from 'vitest'
import { calculateDueBreakdown, daysLate, buildDueDate } from './billingRules.js'
import { DEFAULT_SETTINGS } from './settingsService.js'

describe('billingRules', () => {
  describe('daysLate', () => {
    it('returns 0 for the same day', () => {
      expect(daysLate(new Date(2026, 6, 5), new Date(2026, 6, 5))).toBe(0)
    })

    it('returns positive days when past due', () => {
      expect(daysLate(new Date(2026, 6, 5), new Date(2026, 6, 15))).toBe(10)
    })

    it('returns negative days when before due', () => {
      expect(daysLate(new Date(2026, 6, 5), new Date(2026, 5, 20))).toBe(-15)
    })
  })

  it('builds due date from year, month and day', () => {
    const due = buildDueDate(2026, 8, 5)
    expect(due.getFullYear()).toBe(2026)
    expect(due.getMonth()).toBe(7)
    expect(due.getDate()).toBe(5)
  })

  it('returns zero charges when paid on time', () => {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    settings.billing.autoChargeLateFee = true
    settings.billing.autoChargeInterest = true
    const result = calculateDueBreakdown(189.9, 8, 2026, 5, settings, new Date(2026, 7, 5))
    expect(result.lateFee).toBe(0)
    expect(result.interest).toBe(0)
    expect(result.total).toBe(189.9)
  })

  it('applies no charges within tolerance days', () => {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    settings.billing.autoChargeLateFee = true
    settings.billing.autoChargeInterest = true
    settings.billing.toleranceDays = 5
    const result = calculateDueBreakdown(189.9, 8, 2026, 5, settings, new Date(2026, 7, 9))
    expect(result.lateFee).toBe(0)
    expect(result.interest).toBe(0)
    expect(result.total).toBe(189.9)
  })

  it('applies late fee and daily interest after tolerance', () => {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    settings.billing.autoChargeLateFee = true
    settings.billing.autoChargeInterest = true
    settings.billing.toleranceDays = 5
    settings.billing.lateFeePercent = 2
    settings.billing.interestRatePerDay = 0.033
    // due 05/08, paid 20/08 => 15 days late, 10 overdue days
    const result = calculateDueBreakdown(189.9, 8, 2026, 5, settings, new Date(2026, 7, 20))
    expect(result.daysLate).toBe(15)
    expect(result.lateFee).toBe(3.8)
    expect(result.interest).toBe(0.63) // 189.9 * 0.00033 * 10
    expect(result.total).toBe(194.33)
  })

  it('does not charge when flags are disabled', () => {
    const result = calculateDueBreakdown(189.9, 8, 2026, 5, DEFAULT_SETTINGS, new Date(2026, 9, 20))
    expect(result.lateFee).toBe(0)
    expect(result.interest).toBe(0)
    expect(result.total).toBe(189.9)
  })

  it('rounds to two decimal places', () => {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    settings.billing.autoChargeLateFee = true
    settings.billing.autoChargeInterest = true
    settings.billing.toleranceDays = 0
    settings.billing.lateFeePercent = 3.333
    settings.billing.interestRatePerDay = 0.1
    const result = calculateDueBreakdown(99.99, 1, 2026, 1, settings, new Date(2026, 1, 11))
    expect(result.lateFee).toBe(3.33)
    expect(Number.isInteger(result.total * 100)).toBe(true)
  })
})
