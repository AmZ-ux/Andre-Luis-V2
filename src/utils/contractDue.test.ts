import { describe, it, expect } from 'vitest'
import { firstDueDateBR } from './contractDue'

// Regra do proprietário: a primeira mensalidade vence UM MÊS APÓS o início
// do contrato. Competência = mês do início; vencimento = dia do início no
// mês seguinte (clamp para o último dia válido; virada de ano respeitada).
describe('firstDueDateBR', () => {
  it('1. início 05/10/2026 → primeiro vencimento 05/11/2026', () => {
    expect(firstDueDateBR('2026-10-05')).toBe('05/11/2026')
  })

  it('4. início em dezembro vence no janeiro do próximo ano', () => {
    expect(firstDueDateBR('2026-12-05')).toBe('05/01/2027')
    expect(firstDueDateBR('2026-12-31')).toBe('31/01/2027')
  })

  it('5. início dia 31 com vencimento em fevereiro usa o último dia válido', () => {
    expect(firstDueDateBR('2026-01-31')).toBe('28/02/2026')
  })

  it('6. ano bissexto: 31/01/2028 vence 29/02/2028', () => {
    expect(firstDueDateBR('2028-01-31')).toBe('29/02/2028')
  })

  it('11. exibição no frontend: dia do início preservado no mês seguinte', () => {
    expect(firstDueDateBR('2026-09-30')).toBe('30/10/2026')
    expect(firstDueDateBR('2027-06-15')).toBe('15/07/2027')
  })

  it('retorna null para entrada vazia ou inválida', () => {
    expect(firstDueDateBR('')).toBeNull()
    expect(firstDueDateBR('05/10/2026')).toBeNull()
    expect(firstDueDateBR('abc')).toBeNull()
  })
})
