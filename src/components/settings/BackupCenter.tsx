import { useState } from 'react'
import { Button } from '../ui/Button'
import { HardDrive, Upload, Trash2, RotateCcw, Download } from 'lucide-react'
import type { BackupEntry } from '../../types/settings'

interface BackupCenterProps {
  backups: BackupEntry[]
  onCreateBackup: () => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onDownload: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

export function BackupCenter({ backups, onCreateBackup, onRestore, onDelete, onDownload }: BackupCenterProps) {
  const [restoring, setRestoring] = useState<string | null>(null)

  const handleRestore = (id: string) => {
    setRestoring(id)
    setTimeout(() => {
      onRestore(id)
      setRestoring(null)
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text">Backup manual</p>
          <p className="text-xs text-gray-500 mt-0.5">Crie uma cópia de segurança dos dados do sistema</p>
        </div>
        <Button icon={<HardDrive className="h-4 w-4" />} onClick={onCreateBackup}>
          Criar Backup
        </Button>
      </div>

      {backups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <HardDrive className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">Nenhum backup realizado</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">Histórico de Backups</p>
          {backups.map((b) => (
            <div key={b.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{b.filename}</p>
                <p className="text-xs text-gray-500">
                  {b.size} &middot; {b.type === 'manual' ? 'Manual' : 'Automático'} &middot; {formatDate(b.createdAt)}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onDownload(b.id)}
                  className="h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                  aria-label="Baixar backup"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleRestore(b.id)}
                  disabled={restoring === b.id}
                  className="h-9 px-3 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {restoring === b.id ? (
                    <><RotateCcw className="h-3.5 w-3.5 animate-spin" /> Restaurando...</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> Restaurar</>
                  )}
                </button>
                <button
                  onClick={() => onDelete(b.id)}
                  className="h-9 w-9 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors"
                  aria-label="Excluir backup"
                >
                  <Trash2 className="h-4 w-4 text-error" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
