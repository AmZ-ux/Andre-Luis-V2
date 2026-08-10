import {
  House, Users, Wallet, MessageSquare, Settings, UserCircle, Bus,
  MoreHorizontal, DollarSign, CheckCircle, Clock, AlertTriangle,
  Umbrella, UserPlus, Users2, BarChart3, TrendingUp, MapPin, School,
  CalendarOff, Building2, Shield, HardDrive, Smartphone, MessageCircle,
  Mail, Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  House, Users, Wallet, MessageSquare, Settings, UserCircle, Bus,
  MoreHorizontal, DollarSign, CheckCircle, Clock, AlertTriangle,
  Umbrella, UserPlus, Users2, BarChart3, TrendingUp, MapPin, School,
  CalendarOff, Building2, Shield, HardDrive, Smartphone, MessageCircle,
  Mail, Bell,
}

interface DynamicIconProps {
  name: string
  className?: string
}

export function DynamicIcon({ name, className }: DynamicIconProps) {
  const Icon = iconMap[name]
  if (!Icon) return null
  return <Icon className={className} />
}
