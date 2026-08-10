import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { NotificationsPanel } from './NotificationsPanel'
import { RecentActivity } from './RecentActivity'

describe('Regressao React error #130 (elemento undefined)', () => {
  const serverNotificationTypes = ['info', 'success', 'warning', 'error'] as const

  it('NotificationsPanel renderiza notificacoes com os tipos que o servidor realmente envia', () => {
    const notifications = serverNotificationTypes.map((type, i) => ({
      id: String(i),
      title: 'Notificacao',
      message: 'mensagem',
      time: '10/08',
      type,
      read: false,
    }))

    expect(() =>
      renderToString(
        createElement(NotificationsPanel, {
          notifications: notifications as never,
        })
      )
    ).not.toThrow()
  })

  it('RecentActivity renderiza todas as atividades enviadas pelo servidor', () => {
    const activities = [
      { id: '1', person: 'Fulano', initials: 'F', description: 'Pagamento', time: '10/08', type: 'payment' },
      { id: '2', person: 'Fulano', initials: 'F', description: 'Disponibilidade', time: '10/08', type: 'vacation' },
      { id: '3', person: 'Fulano', initials: 'F', description: 'Registro', time: '10/08', type: 'register' },
      { id: '4', person: 'Fulano', initials: 'F', description: 'Documento', time: '10/08', type: 'document' },
    ]

    expect(() =>
      renderToString(
        createElement(RecentActivity, {
          activities: activities as never,
        })
      )
    ).not.toThrow()
  })
})
