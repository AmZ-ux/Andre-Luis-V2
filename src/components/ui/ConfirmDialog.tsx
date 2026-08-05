import { Modal } from './Modal'
import { Button } from './Button'
import { AlertTriangle, Info } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
}

const variantConfig = {
  danger: { icon: AlertTriangle, color: 'text-error', bg: 'bg-error/10', buttonVariant: 'danger' as const },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', buttonVariant: 'primary' as const },
  info: { icon: Info, color: 'text-primary', bg: 'bg-primary/10', buttonVariant: 'primary' as const },
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'info' }: ConfirmDialogProps) {
  const cfg = variantConfig[variant]
  const Icon = cfg.icon

  return (
    <Modal isOpen={open} onClose={onClose}>
      <div className="text-center">
        <div className={`h-14 w-14 rounded-2xl ${cfg.bg} flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`h-7 w-7 ${cfg.color}`} />
        </div>
        <h3 className="text-base font-semibold text-text mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>{cancelLabel}</Button>
          <Button variant={cfg.buttonVariant} fullWidth onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}
