export type MessageStatus = 'draft' | 'scheduled' | 'sent' | 'failed' | 'cancelled'
export type MessageType = 'individual' | 'group' | 'all'
export type MessagePriority = 'low' | 'normal' | 'high'
export type ChannelType = 'app' | 'whatsapp' | 'email' | 'sms' | 'push'
export type ChannelStatusValue = 'connected' | 'disconnected' | 'configuring' | 'error'
export type NotificationStatus = 'unread' | 'read' | 'favorite' | 'archived'
export type RecipientFilter = 'individual' | 'city' | 'institution' | 'company' | 'transportType' | 'status' | 'all'
export type TemplateCategory = 'reminder' | 'payment' | 'receipt_approved' | 'receipt_rejected' | 'vacation_return' | 'welcome' | 'custom'

export interface Recipient {
  type: RecipientFilter
  value?: string
  label: string
}

export interface MessageTemplate {
  id: string
  name: string
  category: TemplateCategory
  subject: string
  body: string
  variables: string[]
  channel: ChannelType
  createdAt: string
  updatedAt: string
}

export interface Channel {
  type: ChannelType
  name: string
  icon: string
  status: ChannelStatusValue
  enabled: boolean
  configurable: boolean
}

export interface CommunicationMessage {
  id: string
  title: string
  subject: string
  body: string
  type: MessageType
  status: MessageStatus
  priority: MessagePriority
  channel: ChannelType
  templateId?: string
  recipients: Recipient[]
  scheduledAt?: string
  sentAt?: string
  failedAt?: string
  errorMessage?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CommunicationSummary {
  sent: number
  pending: number
  scheduled: number
  failed: number
  total: number
  lastCommunication?: string
}

export interface Notification {
  id: string
  title: string
  message: string
  status: NotificationStatus
  type: 'info' | 'success' | 'warning' | 'error'
  link?: string
  createdAt: string
  readAt?: string
}

export interface NotificationPreferences {
  enabled: boolean
  sound: boolean
  reminders: boolean
  messageTypes: {
    payment: boolean
    receipt: boolean
    availability: boolean
    system: boolean
    promotional: boolean
  }
}

export interface ScheduledMessage {
  id: string
  messageId: string
  scheduledDate: string
  scheduledTime: string
  status: 'pending' | 'sent' | 'cancelled'
  createdAt: string
}

export interface HistoryEntry {
  id: string
  messageId: string
  action: 'created' | 'edited' | 'scheduled' | 'cancelled' | 'sent' | 'failed'
  description: string
  performedBy: string
  timestamp: string
}

export interface CommunicationFilters {
  period: string
  type: MessageType | ''
  channel: ChannelType | ''
  status: MessageStatus | ''
  search: string
}
