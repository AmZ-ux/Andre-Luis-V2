import type { MessageTemplate, TemplateCategory, ChannelType } from '../types/communication'

const STORAGE_KEY = 'mock_templates'

const defaultTemplates: MessageTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Lembrete de Vencimento',
    category: 'reminder',
    subject: 'Lembrete de pagamento',
    body: 'Olá {{nome}}, sua mensalidade de {{valor}} vence em {{vencimento}}. Não se esqueça de realizar o pagamento.',
    variables: ['nome', 'valor', 'vencimento'],
    channel: 'app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-2',
    name: 'Pagamento Recebido',
    category: 'payment',
    subject: 'Pagamento confirmado',
    body: '{{nome}}, recebemos o pagamento da sua mensalidade no valor de {{valor}}. Obrigado!',
    variables: ['nome', 'valor'],
    channel: 'app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-3',
    name: 'Comprovante Aprovado',
    category: 'receipt_approved',
    subject: 'Comprovante aprovado',
    body: '{{nome}}, seu comprovante de {{valor}} foi aprovado com sucesso.',
    variables: ['nome', 'valor'],
    channel: 'app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-4',
    name: 'Comprovante Rejeitado',
    category: 'receipt_rejected',
    subject: 'Comprovante rejeitado',
    body: '{{nome}}, seu comprovante de {{valor}} foi rejeitado. Por favor, envie um novo comprovante.',
    variables: ['nome', 'valor'],
    channel: 'app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-5',
    name: 'Retorno de Férias',
    category: 'vacation_return',
    subject: 'Bem-vindo de volta',
    body: '{{nome}}, seja bem-vindo de volta! Suas mensalidades serão retomadas a partir de agora.',
    variables: ['nome'],
    channel: 'app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-6',
    name: 'Boas-vindas',
    category: 'welcome',
    subject: 'Bem-vindo ao Transporte André Luis',
    body: 'Olá {{nome}}, seja bem-vindo! Sua empresa é {{empresa}}. Em breve você receberá informações sobre suas mensalidades.',
    variables: ['nome', 'empresa'],
    channel: 'app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function load(): MessageTemplate[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTemplates))
  return defaultTemplates
}

function save(templates: MessageTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

function generateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const templateService = {
  list(): MessageTemplate[] {
    return load()
  },

  getById(id: string): MessageTemplate | undefined {
    return load().find((t) => t.id === id)
  },

  create(data: {
    name: string
    category: TemplateCategory
    subject: string
    body: string
    channel: ChannelType
  }): MessageTemplate {
    const variables = extractVariables(data.body)
    const template: MessageTemplate = {
      id: generateId(),
      name: data.name,
      category: data.category,
      subject: data.subject,
      body: data.body,
      variables,
      channel: data.channel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const templates = load()
    templates.push(template)
    save(templates)
    return template
  },

  update(id: string, data: Partial<{
    name: string
    category: TemplateCategory
    subject: string
    body: string
    channel: ChannelType
  }>): MessageTemplate {
    const templates = load()
    const index = templates.findIndex((t) => t.id === id)
    if (index === -1) throw new Error('Template não encontrado')
    const template = templates[index]
    if (data.name !== undefined) template.name = data.name
    if (data.category !== undefined) template.category = data.category
    if (data.subject !== undefined) template.subject = data.subject
    if (data.body !== undefined) {
      template.body = data.body
      template.variables = extractVariables(data.body)
    }
    if (data.channel !== undefined) template.channel = data.channel
    template.updatedAt = new Date().toISOString()
    templates[index] = template
    save(templates)
    return template
  },

  delete(id: string): void {
    const templates = load().filter((t) => t.id !== id)
    save(templates)
  },

  render(template: MessageTemplate, values: Record<string, string>): string {
    let body = template.body
    for (const [key, value] of Object.entries(values)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    return body
  },
}

function extractVariables(body: string): string[] {
  const regex = /\{\{(\w+)\}\}/g
  const vars: string[] = []
  let match
  while ((match = regex.exec(body)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1])
  }
  return vars
}
