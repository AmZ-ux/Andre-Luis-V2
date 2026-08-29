import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { PassengerAvatar } from './PassengerAvatar'
import { PassengerStatusBadge } from './PassengerStatusBadge'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Passenger } from '../../types/passenger'

interface PassengerCardProps {
  passenger: Passenger
  onEdit: (p: Passenger) => void
  onDelete: (p: Passenger) => void
  index: number
  canDelete?: boolean
}

const typeLabel: Record<string, string> = {
  university: 'Universitário',
  school: 'Escolar',
  contract: 'Contrato',
}

export function PassengerCard({ passenger, onEdit, onDelete, index, canDelete = true }: PassengerCardProps) {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-5"
    >
      <div className="flex items-start gap-4">
        <PassengerAvatar name={passenger.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <button
                onClick={() => navigate(`/passageiros/${passenger.id}`)}
                className="text-base font-semibold text-text hover:text-primary transition-colors text-left"
              >
                {passenger.name}
              </button>
              <p className="text-xs text-gray-500 mt-0.5">{passenger.cpf}</p>
            </div>
            <PassengerStatusBadge status={passenger.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
            <span>{passenger.phone}</span>
            <span>{passenger.email}</span>
            <span>{passenger.address.city}/{passenger.address.state}</span>
            <span>{typeLabel[passenger.transportType]}</span>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-xs text-gray-400">Mensalidade</p>
              <p className="text-sm font-bold text-text">
                R$ {passenger.monthlyFee.toFixed(2).replace('.', ',')}
              </p>
            </div>
              <div className="flex gap-1">
              <button
                onClick={() => navigate(`/passageiros/${passenger.id}`)}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                aria-label="Visualizar"
              >
                <Eye className="h-4 w-4 text-gray-400" />
              </button>
              <button
                onClick={() => onEdit(passenger)}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4 text-gray-400" />
              </button>
              {canDelete && (
                <button
                  onClick={() => onDelete(passenger)}
                  className="h-9 w-9 rounded-lg hover:bg-error-soft flex items-center justify-center transition-colors"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4 text-error" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
