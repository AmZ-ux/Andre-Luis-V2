import type { Channel, ChannelType, ChannelStatusValue } from '../types/communication'

const STORAGE_KEY = 'mock_channels'

const defaultChannels: Channel[] = [
  { type: 'app', name: 'Aplicativo', icon: 'Smartphone', status: 'connected', enabled: true, configurable: false },
  { type: 'whatsapp', name: 'WhatsApp', icon: 'MessageCircle', status: 'disconnected', enabled: false, configurable: true },
  { type: 'email', name: 'E-mail', icon: 'Mail', status: 'disconnected', enabled: false, configurable: true },
  { type: 'sms', name: 'SMS', icon: 'MessageSquare', status: 'disconnected', enabled: false, configurable: true },
  { type: 'push', name: 'Push Notification', icon: 'Bell', status: 'disconnected', enabled: false, configurable: true },
]

function load(): Channel[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultChannels))
  return defaultChannels
}

function save(channels: Channel[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channels))
}

export const channelService = {
  list(): Channel[] {
    return load()
  },

  getByType(type: ChannelType): Channel | undefined {
    return load().find((c) => c.type === type)
  },

  updateStatus(type: ChannelType, status: ChannelStatusValue): Channel {
    const channels = load()
    const index = channels.findIndex((c) => c.type === type)
    if (index === -1) throw new Error(`Canal ${type} não encontrado`)
    channels[index].status = status
    save(channels)
    return channels[index]
  },

  toggleEnabled(type: ChannelType, enabled: boolean): Channel {
    const channels = load()
    const index = channels.findIndex((c) => c.type === type)
    if (index === -1) throw new Error(`Canal ${type} não encontrado`)
    channels[index].enabled = enabled
    save(channels)
    return channels[index]
  },

  getActiveCount(): number {
    return load().filter((c) => c.enabled && c.status === 'connected').length
  },

  reset(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultChannels))
  },
}
