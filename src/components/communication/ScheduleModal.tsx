import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { CalendarDays, Clock } from 'lucide-react'

interface ScheduleModalProps {
  open: boolean
  onClose: () => void
  onSchedule: (date: string, time: string) => void
}

export function ScheduleModal({ open, onClose, onSchedule }: ScheduleModalProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('09:00')

  const handleSchedule = () => {
    onSchedule(date, time)
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <Modal isOpen={open} onClose={onClose} title="Agendar Mensagem">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">Escolha a data e hora para o envio da mensagem.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              <CalendarDays className="h-4 w-4 inline mr-1.5 text-primary" />
              Data
            </label>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              <Clock className="h-4 w-4 inline mr-1.5 text-primary" />
              Hora
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancelar</Button>
          <Button fullWidth onClick={handleSchedule} icon={<Clock className="h-4 w-4" />}>
            Agendar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
