import { useSearchParams } from 'react-router-dom'
import { MessageSquare, Settings } from 'lucide-react'
import { CommunicationCenter } from '../components/communication/CommunicationCenter'
import { CommunicationSettingsForm } from '../components/settings/CommunicationSettings'
import { PageTabs } from '../components/ui/PageTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { NotificationBell } from '../components/layout/NotificationBell'
import { Card } from '../components/ui/Card'
import { useSettings } from '../hooks/useSettings'

const tabs = [
  { key: 'mensagens', label: 'Mensagens', icon: MessageSquare },
  { key: 'configuracoes', label: 'Configurações', icon: Settings },
]

export function CentralComunicacao() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { settings, updateCategory, saved } = useSettings()

  const tab = searchParams.get('tab') === 'configuracoes' ? 'configuracoes' : 'mensagens'

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'mensagens' ? {} : { tab: key }, { replace: true })
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        className="hidden sm:block"
        eyebrow="Operação"
        title="Comunicação"
        subtitle={
          tab === 'configuracoes'
            ? 'Configurações de mensagens e templates'
            : 'Envie mensagens e notificações para os passageiros'
        }
      />

      <div className="flex items-center justify-between gap-3">
        <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />
        <NotificationBell className="shrink-0" />
      </div>

      {tab === 'configuracoes' ? (
        <Card>
          <CommunicationSettingsForm
            settings={settings.communication}
            onSave={(v) => updateCategory('communication', v)}
            saved={saved}
          />
        </Card>
      ) : (
        <CommunicationCenter embedded />
      )}
    </div>
  )
}
