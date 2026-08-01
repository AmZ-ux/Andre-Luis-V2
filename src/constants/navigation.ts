import type { NavItem } from '../types'

export const NAV_ITEMS: NavItem[] = [
  { label: 'Início', path: '/', icon: 'House' },
  { label: 'Passageiros', path: '/passageiros', icon: 'Users' },
  { label: 'Mensalidades', path: '/mensalidades', icon: 'Wallet' },
  { label: 'Comunicação', path: '/comunicacao', icon: 'MessageSquare' },
  { label: 'Configurações', path: '/configuracoes', icon: 'Settings' },
]

export const PROFILE_ITEM: NavItem = { label: 'Meu Perfil', path: '/perfil', icon: 'UserCircle' }

export const PASSENGER_NAV_ITEMS: NavItem[] = [
  { label: 'Início', path: '/', icon: 'House' },
  { label: 'Comprovantes', path: '/meus-comprovantes', icon: 'FileCheck' },
  { label: 'Disponibilidade', path: '/minha-disponibilidade', icon: 'CalendarOff' },
]
