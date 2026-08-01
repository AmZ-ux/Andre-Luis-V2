import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AlertTriangle } from 'lucide-react'

interface DeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  passengerName: string
  loading?: boolean
}

export function DeleteModal({ isOpen, onClose, onConfirm, passengerName, loading }: DeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-error" />
        </div>
        <h3 className="text-lg font-semibold text-text mb-1">Excluir passageiro</h3>
        <p className="text-sm text-gray-500 mb-2">
          Tem certeza que deseja excluir <strong className="text-text">{passengerName}</strong>?
        </p>
        <p className="text-xs text-gray-400 mb-6">Esta ação não pode ser desfeita.</p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" fullWidth onClick={onConfirm} loading={loading}>
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  )
}
