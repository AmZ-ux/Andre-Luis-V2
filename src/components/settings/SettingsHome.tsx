import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import { SettingsMenu } from './SettingsMenu'
import { CompanySettingsForm } from './CompanySettings'
import { FinancialSettingsForm } from './FinancialSettings'
import { SecuritySettingsForm } from './SecuritySettings'
import { BackupCenter } from './BackupCenter'
import { LogsViewer } from './LogsViewer'
import { AuditHistory } from './AuditHistory'
import { SystemSettingsForm } from './SystemSettingsForm'
import { useSettings } from '../../hooks/useSettings'
import { SETTINGS_CATEGORIES } from '../../types/settings'
import type { SettingsCategory } from '../../types/settings'
import { AdminsManager } from './AdminsManager'
import { Search, History, FileText, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

type InnerTab = 'settings' | 'audit' | 'logs'

const innerTabs: { key: InnerTab; label: string; icon: typeof FileText }[] = [
  { key: 'settings', label: 'Configurações', icon: FileText },
  { key: 'audit', label: 'Auditoria', icon: History },
  { key: 'logs', label: 'Logs', icon: Search },
]

export function SettingsHome() {
  const {
    settings, auditLog, logs, backups, saved,
    updateCategory, createBackup, restoreBackup, deleteBackup, downloadBackup,
    clearLogs, clearAudit,
  } = useSettings()

  const [activeCategory, setActiveCategory] = useState<SettingsCategory | null>('company')
  const [innerTab, setInnerTab] = useState<InnerTab>('settings')

  const currentCat = SETTINGS_CATEGORIES.find((c) => c.key === activeCategory)

  const renderContent = () => {
    if (innerTab === 'audit') {
      return (
        <Card>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-text">Auditoria de Alterações</h3>
            <p className="text-xs text-gray-500 mt-0.5">Registro de todas as alterações de configuração</p>
          </div>
          <AuditHistory auditLog={auditLog} onClear={clearAudit} />
        </Card>
      )
    }

    if (innerTab === 'logs') {
      return (
        <Card>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-text">Central de Logs</h3>
            <p className="text-xs text-gray-500 mt-0.5">Registro de eventos do sistema</p>
          </div>
          <LogsViewer logs={logs} onClear={clearLogs} />
        </Card>
      )
    }

    if (!activeCategory || !currentCat) {
      return (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <SettingsIcon className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">Selecione uma categoria ao lado</p>
          </div>
        </Card>
      )
    }

    const renderForm = () => {
      switch (activeCategory) {
        case 'company':
          return <CompanySettingsForm settings={settings.company} onSave={(v) => updateCategory('company', v)} saved={saved} />
        case 'financial':
          return <FinancialSettingsForm settings={settings.financial} onSave={(v) => updateCategory('financial', v)} saved={saved} />
        case 'security':
          return <SecuritySettingsForm settings={settings.security} onSave={(v) => updateCategory('security', v)} saved={saved} />
        case 'backup':
          return <BackupCenter backups={backups} onCreateBackup={createBackup} onRestore={restoreBackup} onDelete={deleteBackup} onDownload={downloadBackup} />
        case 'system':
          return <SystemSettingsForm settings={settings.system} onSave={(v) => updateCategory('system', v)} saved={saved} />
        case 'users':
          return <AdminsManager />
        default:
          return null
      }
    }

    return <Card>{renderForm()}</Card>
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Administração</h1>
        <p className="text-sm text-gray-500 mt-1">Central de configurações do sistema</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {innerTabs.map((tab) => {
          const TabIcon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setInnerTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200',
                innerTab === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {innerTab === 'settings' ? (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-64 shrink-0">
            <Card padding={false}>
              <div className="p-3">
                <SettingsMenu activeCategory={activeCategory} onSelect={setActiveCategory} />
              </div>
            </Card>
          </div>

          <div className="flex-1 min-w-0">
            <motion.div
              key={`${innerTab}-${activeCategory}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {currentCat && (
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-base font-semibold text-text">{currentCat.label}</h2>
                  <span className="text-xs text-gray-400">{currentCat.description}</span>
                </div>
              )}
              {renderContent()}
            </motion.div>
          </div>
        </div>
      ) : (
        <motion.div
          key={innerTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      )}
    </div>
  )
}
