import { LegalLayout } from '../../components/legal/LegalLayout'
import { useCompanyInfo } from '../../hooks/useCompanyInfo'
import { fillLegalText } from '../../utils/legalText'

interface TermsSection {
  title: string
  paragraphs?: string[]
  items?: string[]
}

const sections: TermsSection[] = [
  {
    title: '1. Aceitação dos Termos',
    paragraphs: [
      'Estes Termos de Uso ("Termos") regulam o acesso e a utilização da plataforma digital da Transporte André Luis ("Transporte André Luis", "nós" ou "nós"), inscrita sob o CNPJ {cnpj}, com sede em {cidadeUf}, destinada à gestão de mensalidades, disponibilidade e comunicação entre a empresa e os passageiros.',
      'Ao criar uma conta ou utilizar os serviços, você declara ter lido, compreendido e aceitado integralmente estes Termos e a Política de Privacidade, em conformidade com a Lei nº 13.709/2018 (LGPD) e demais legislações aplicáveis. Caso não concorde com qualquer disposição, não utilize os serviços.',
    ],
  },
  {
    title: '2. Objeto do serviço',
    paragraphs: [
      'A plataforma oferece aos passageiros e responsáveis as seguintes funcionalidades:',
    ],
    items: [
      'Acompanhamento de mensalidades, vencimentos e status de pagamento;',
      'Pagamento de mensalidades via PIX ou cartão de crédito, processados pelo Mercado Pago;',
      'Registro de períodos de disponibilidade/ausência (férias, viagens, etc.);',
      'Recebimento de comunicações da empresa, inclusive por WhatsApp;',
      'Acompanhamento de notificações e avisos relevantes.',
    ],
  },
  {
    title: '3. Cadastro e conta de acesso',
    items: [
      'O cadastro exige informações verdadeiras, completas e atualizadas (nome, e-mail, CPF, telefone e demais dados solicitados);',
      'A conta é pessoal e intransferível; o usuário é responsável pela confidencialidade de sua senha e por todas as atividades realizadas em sua conta;',
      'O cadastro só pode ser concluído após a aceitação expressa destes Termos e da Política de Privacidade;',
      'O usuário compromete-se a comunicar imediatamente qualquer uso não autorizado de sua conta ou violação de segurança;',
      'A Transporte André Luis poderá bloquear ou cancelar contas que utilizem dados falsos ou que violem estes Termos.',
    ],
  },
  {
    title: '4. Mensalidades e pagamentos',
    items: [
      'A mensalidade é gerada mensalmente conforme a data de início do contrato informada no cadastro;',
      'Os pagamentos via PIX e cartão de crédito são processados pelo Mercado Pago, que atua como operador de pagamento, sujeito às próprias políticas e regulamentos;',
      'A confirmação do pagamento via PIX/cartão é verificada eletronicamente junto ao Mercado Pago;',
      'A Transporte André Luis não se responsabiliza por falhas na operação do Mercado Pago ou de qualquer outro provedor externo;',
      'O não pagamento da mensalidade poderá implicar a suspensão do serviço de transporte, nos termos do contrato de transporte firmado entre as partes.',
    ],
  },
  {
    title: '5. Disponibilidade e ausências',
    items: [
      'O passageiro pode registrar períodos em que não utilizará o transporte, conforme a política de férias/ausência vigente;',
      'Os períodos registrados devem ser informados com antecedência e estão sujeitos à confirmação da empresa;',
      'A aplicação de descontos, isenções ou cobranças proporcionais durante ausências seguirá a política definida no contrato de transporte.',
    ],
  },
  {
    title: '6. Comunicação',
    items: [
      'Ao fornecer seu número de telefone/WhatsApp, você autoriza o envio de mensagens relacionadas ao serviço, como avisos de vencimento, alterações de rota e comunicados importantes;',
      'As mensagens enviadas por WhatsApp são processadas por provedor de mensageria e sujeitas às políticas próprias do WhatsApp (Meta);',
      'Você pode solicitar o cancelamento de comunicações comerciais a qualquer momento, exceto aquelas necessárias à execução do contrato.',
    ],
  },
  {
    title: '7. Obrigações do usuário',
    items: [
      'Fornecer dados verdadeiros e mantê-los atualizados;',
      'Utilizar a plataforma apenas para as finalidades previstas;',
      'Não acessar, alterar ou utilizar dados de terceiros sem autorização;',
      'Não tentar burlar mecanismos de segurança, autenticação ou pagamento;',
      'Não divulgar dados ou informações de outros passageiros;',
    ],
  },
  {
    title: '8. Condutas proibidas',
    items: [
      'Utilizar a plataforma para fins ilegais, fraudulentos ou não autorizados;',
      'Realizar engenharia reversa, extração ou scraping de dados;',
      'Interferir na disponibilidade ou integridade do sistema;',
      'Causar danos a terceiros ou à empresa por meio da plataforma.',
      'A violação destas condutas poderá resultar no bloqueio imediato da conta, sem prejuízo das medidas judiciais cabíveis.',
    ],
  },
  {
    title: '9. Propriedade intelectual',
    paragraphs: [
      'A plataforma, seu código-fonte, design, logotipos, textos, gráficos e demais conteúdos são de propriedade exclusiva da Transporte André Luis ou de seus licenciantes, protegidos pela legislação brasileira (Lei nº 9.610/1998 e Lei nº 9.279/1996).',
      'Nenhuma disposição destes Termos confere ao usuário qualquer direito de uso, reprodução ou distribuição desses conteúdos, exceto para uso pessoal e limitado aos fins do serviço.',
    ],
  },
  {
    title: '10. Privacidade e proteção de dados',
    paragraphs: [
      'O tratamento de dados pessoais realizado pela plataforma observa integralmente a Lei nº 13.709/2018 (LGPD) e está descrito na nossa Política de Privacidade, que integra estes Termos.',
      'Ao utilizar os serviços, você declara ter ciência das finalidades, bases legais, compartilhamentos e direitos previstos na Política de Privacidade.',
    ],
  },
  {
    title: '11. Limitação de responsabilidade',
    items: [
      'A plataforma é disponibilizada no estado em que se encontra, com atualizações e correções contínuas;',
      'A Transporte André Luis não se responsabiliza por indisponibilidades temporárias, manutenções programadas ou falhas de terceiros (provedores de pagamento, mensageria, internet, energia, etc.);',
      'A responsabilidade por informações inseridas pelo usuário é exclusiva do próprio usuário;',
      'A Transporte André Luis não se responsabiliza por danos indiretos, lucros cessantes ou perdas de oportunidade decorrentes do uso ou da impossibilidade de uso da plataforma, nos limites da lei aplicável.',
    ],
  },
  {
    title: '12. Cancelamento e exclusão de conta',
    items: [
      'O usuário pode solicitar o encerramento do contrato de transporte e a exclusão de sua conta a qualquer momento, pelos canais de atendimento;',
      'A exclusão da conta não elimina os registros que a lei exige que sejam mantidos (ex.: documentos fiscais e registros de pagamento), que serão conservados pelo prazo legal e posteriormente eliminados;',
      'A Transporte André Luis poderá suspender ou encerrar a conta em caso de violação destes Termos ou da legislação aplicável.',
    ],
  },
  {
    title: '13. Alterações destes Termos',
    paragraphs: [
      'Estes Termos podem ser atualizados periodicamente. A versão vigente estará sempre disponível nesta página, com a data da última atualização indicada no topo.',
      'Alterações relevantes serão comunicadas por meio da plataforma. A continuidade do uso dos serviços após a publicação de alterações implica a aceitação da nova versão dos Termos.',
    ],
  },
  {
    title: '14. Lei aplicável e foro',
    paragraphs: [
      'Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de {cidadeUf} para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.',
      'Para dúvidas ou atendimento relacionado a estes Termos, contate-nos pelos canais indicados na Política de Privacidade.',
    ],
  },
]

export function TermsPage() {
  const company = useCompanyInfo()
  return (
    <LegalLayout title="Termos de Uso" updatedAt="08/08/2026">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-base sm:text-lg font-semibold text-text mb-3">{section.title}</h2>

          {section.paragraphs?.map((paragraph, i) => (
            <p key={i} className="mb-3">
              {fillLegalText(paragraph, company)}
            </p>
          ))}

          {section.items && (
            <ul className="space-y-2 list-disc pl-5">
              {section.items.map((item, i) => (
                <li key={i}>{fillLegalText(item, company)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </LegalLayout>
  )
}
