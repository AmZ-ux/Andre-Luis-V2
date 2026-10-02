// Regra contratual do proprietário: a primeira mensalidade vence UM MÊS APÓS
// o início do contrato. Competência = mês do início; vencimento = dia do início
// no mês seguinte (dia maior que o último dia do mês-alvo usa o último dia
// válido; virada de ano respeitada).

export function firstDueDateBR(contractStartDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contractStartDate)) return null
  const [y, m, d] = contractStartDate.split('-').map(Number)
  if (!y || !m || !d) return null
  const dueMonth = m === 12 ? 1 : m + 1
  const dueYear = m === 12 ? y + 1 : y
  const lastDay = new Date(dueYear, dueMonth, 0).getDate()
  const dueDay = Math.min(d, lastDay)
  return `${String(dueDay).padStart(2, '0')}/${String(dueMonth).padStart(2, '0')}/${dueYear}`
}
