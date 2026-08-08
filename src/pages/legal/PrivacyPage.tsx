import { LegalLayout } from '../../components/legal/LegalLayout'

interface DataSection {
  title: string
  paragraphs?: string[]
  items?: string[]
  table?: { cols: string[]; rows: string[][] }
}

const sections: DataSection[] = [
  {
    title: '1. Quem somos (Controlador)',
    paragraphs: [
      'A Transporte André Luis (doravante "Transporte André Luis", "nós" ou "nós"), inscrita sob o CNPJ [CNPJ], com sede em [cidade/UF], é a controladora dos dados pessoais tratados por meio desta plataforma, nos termos do art. 5º, VI, da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais – "LGPD").',
      'Esta Política de Privacidade descreve, de forma clara e transparente, como coletamos, utilizamos, armazenamos, compartilhamos e protegemos os seus dados pessoais no âmbito do serviço de gestão de mensalidades e transporte de passageiros, bem como os seus direitos como titular de dados.',
    ],
  },
  {
    title: '2. Definições',
    items: [
      'Dado pessoal: informação relacionada a pessoa natural identificada ou identificável (art. 5º, I, LGPD);',
      'Titular: pessoa natural a quem se referem os dados pessoais;',
      'Controlador: pessoa jurídica responsável pelas decisões sobre o tratamento;',
      'Operador: pessoa jurídica ou natural que trata dados em nome do controlador;',
      'Tratamento: toda operação realizada com dados pessoais (coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração).',
    ],
  },
  {
    title: '3. Quais dados pessoais coletamos',
    paragraphs: [
      'Coletamos apenas os dados pessoais estritamente necessários à prestação do serviço de transporte e à gestão das mensalidades, nas seguintes categorias:',
    ],
    table: {
      cols: ['Categoria', 'Dados', 'Finalidade', 'Base legal (art. 7º LGPD)'],
      rows: [
        ['Cadastro e identificação', 'Nome completo, CPF, RG, data de nascimento, telefone, WhatsApp, e-mail', 'Identificação do titular, criação da conta, contratação do serviço de transporte e emissão de documentos', 'Execução de contrato (inc. V) e legítimo interesse (inc. IX)'],
        ['Contrato de transporte', 'Tipo de transporte, instituição/curso/turma, empresa, ponto de saída, destino, data de início do contrato', 'Prestação do serviço de transporte e definição de rotas', 'Execução de contrato (inc. V)'],
        ['Endereço', 'CEP, logradouro, número, complemento, bairro, cidade, estado', 'Definição de rotas e logística do serviço', 'Execução de contrato (inc. V)'],
        ['Financeiro', 'Valor da mensalidade, dia de vencimento, forma de pagamento, histórico de mensalidades e pagamentos', 'Cobrança e gestão financeira do contrato', 'Execução de contrato (inc. V) e cumprimento de obrigação legal/fiscal (inc. II)'],
        ['Pagamentos', 'E-mail, CPF e nome enviados ao provedor de pagamento para a transação', 'Processamento de pagamentos via PIX e cartão', 'Execução de contrato (inc. V) e consentimento do titular junto ao provedor'],
        ['Comprovantes', 'Arquivos de comprovantes de pagamento (imagem/PDF) enviados pelo titular', 'Validação e registro dos pagamentos', 'Execução de contrato (inc. V)'],
        ['Disponibilidade', 'Períodos de ausência, motivos e observações', 'Gestão de disponibilidade do transporte', 'Execução de contrato (inc. V)'],
        ['Comunicação', 'Mensagens enviadas pelo aplicativo e por WhatsApp, notificações', 'Comunicação sobre o serviço, avisos de vencimento e informações relevantes', 'Execução de contrato (inc. V) e legítimo interesse (inc. IX)'],
        ['Navegação e segurança', 'Endereço IP, dados de acesso, logs de auditoria e de aplicação', 'Segurança da informação, prevenção de fraudes e conformidade', 'Legítimo interesse (inc. IX) e cumprimento de obrigação legal (inc. II)'],
      ],
    },
  },
  {
    title: '4. Bases legais do tratamento',
    paragraphs: [
      'O tratamento dos seus dados pessoais está fundamentado nas seguintes bases legais previstas no art. 7º da LGPD:',
    ],
    items: [
      'Execução de contrato ou de procedimentos preliminares (inc. V): dados necessários à prestação do serviço de transporte e gestão das mensalidades;',
      'Cumprimento de obrigação legal ou regulatória (inc. II): retenção de documentos para fins fiscais e contábeis;',
      'Legítimo interesse (inc. IX): segurança da informação, prevenção de fraudes, melhoria do serviço e comunicação com o titular;',
      'Consentimento (inc. I): quando aplicável, por exemplo, para recebimento de comunicações de marketing ou para o envio de dados ao provedor de pagamento. O consentimento pode ser revogado a qualquer momento pelo titular.',
    ],
  },
  {
    title: '5. Dados de crianças e adolescentes',
    paragraphs: [
      'O serviço pode envolver o tratamento de dados pessoais de crianças e adolescentes (transportes escolar e universitário). Nesses casos, o tratamento é realizado no estrito cumprimento do contrato de transporte firmado pelos pais ou responsáveis legais, com base no art. 14 da LGPD e no art. 7º, inciso V, não sendo exigido o consentimento específico de que trata o § 1º do art. 14, por se tratar de execução de contrato.',
      'Os responsáveis legais poderão, a qualquer momento, exercer os direitos previstos nesta Política em nome das crianças e adolescentes.',
    ],
  },
  {
    title: '6. Compartilhamento de dados',
    paragraphs: [
      'Os seus dados pessoais são compartilhados apenas com terceiros estritamente necessários à prestação do serviço, sempre com cláusulas contratuais de proteção de dados e nos limites do necessário:',
    ],
    items: [
      'Mercado Pago (operador): processamento de pagamentos via PIX e cartão de crédito. São compartilhados nome, e-mail e CPF do titular, exclusivamente para a realização da transação. Consulte a política de privacidade do Mercado Pago em mercadolivre.com.br/privacidade;',
      'Provedor de mensageria WhatsApp (via API Evolution): envio de mensagens sobre o serviço, quando autorizado;',
      'Provedor de hospedagem (Railway): armazenamento dos dados em servidores, com criptografia e controle de acesso;',
      'Autoridades públicas e Poder Judiciário: mediante requisição legal, ordem judicial ou por exigência regulatória.',
      'Não vendemos, alugamos ou compartilhamos os seus dados pessoais com terceiros para fins de marketing ou publicidade sem o seu consentimento.',
    ],
  },
  {
    title: '7. Armazenamento e retenção',
    paragraphs: [
      'Os dados pessoais são armazenados em servidores protegidos, com criptografia em trânsito (TLS) e em repouso, controle de acesso baseado em funções (RBAC) e registro de auditoria das operações.',
      'Os dados são mantidos pelo prazo necessário ao cumprimento das finalidades para as quais foram coletados, respeitando os seguintes períodos:',
    ],
    items: [
      'Dados do contrato e mensalidades: enquanto durar o contrato de transporte e, após o encerramento, pelo prazo de 5 (cinco) anos para fins de cumprimento de obrigações fiscais e contábeis (art. 7º, II, LGPD);',
      'Dados de pagamento e comprovantes: pelo prazo de 5 (cinco) anos, para fins fiscais;',
      'Logs de auditoria e segurança: conforme a política de retenção do sistema, limitada ao período necessário à segurança da informação;',
      'Após o término do prazo, os dados são eliminados ou anonimizados de forma segura.',
    ],
  },
  {
    title: '8. Segurança da informação',
    paragraphs: [
      'Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão, nos termos do art. 46 da LGPD, incluindo:',
    ],
    items: [
      'Criptografia de dados em trânsito (HTTPS/TLS) e em repouso;',
      'Senhas armazenadas com hash criptográfico e sessões com expiração automática;',
      'Controle de acesso baseado em funções (RBAC) e registro de auditoria de todas as operações sensíveis;',
      'Backups automáticos diários e política de retenção definida;',
      'Monitoramento de acessos e detecção de atividades anômalas.',
      'Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a ANPD e os titulares afetados, nos termos do art. 48 da LGPD.',
    ],
  },
  {
    title: '9. Direitos do titular',
    paragraphs: [
      'Nos termos do art. 18 da LGPD, você pode, a qualquer momento, solicitar:',
    ],
    items: [
      'Confirmação da existência de tratamento dos seus dados;',
      'Acesso aos seus dados pessoais;',
      'Correção de dados incompletos, inexatos ou desatualizados;',
      'Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;',
      'Portabilidade dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa;',
      'Eliminação dos dados tratados com consentimento, exceto nas hipóteses legais de conservação (arts. 16 e 17 da LGPD);',
      'Informação sobre as entidades públicas e privadas com as quais o controlador realizou uso compartilhado de dados;',
      'Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;',
      'Revogação do consentimento, quando o tratamento estiver fundamentado nessa base legal.',
      'As solicitações devem ser encaminhadas ao Encarregado pelo e-mail [email] e serão respondidas em até 15 (quinze) dias, nos termos do art. 19 da LGPD. Havendo pedido de eliminação, os dados serão apagados, ressalvadas as hipóteses legais de conservação.',
    ],
  },
  {
    title: '10. Cookies e tecnologias de armazenamento',
    paragraphs: [
      'Este site utiliza exclusivamente tecnologias de armazenamento local (localStorage) e tokens de sessão necessários ao funcionamento da plataforma, como a manutenção da sessão de login e preferências de tema. Não utilizamos cookies de rastreamento ou publicidade.',
      'Você pode limpar o armazenamento local do seu navegador a qualquer momento; nesse caso, será necessário realizar novo login.',
    ],
  },
  {
    title: '11. Encarregado de Dados (DPO)',
    paragraphs: [
      'O Encarregado pelo tratamento de dados pessoais (DPO), nos termos do art. 41 da LGPD, pode ser contatado pelos seguintes canais:',
    ],
    items: [
      'E-mail: [email]',
      'Endereço: [endereço da empresa]',
      'Telefone/WhatsApp: [telefone]',
    ],
  },
  {
    title: '12. Alterações desta Política',
    paragraphs: [
      'Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças legais, tecnológicas ou operacionais. A versão vigente estará sempre disponível nesta página, com a data da última atualização indicada no topo. Quando houver alterações relevantes, comunicaremos por meio do aplicativo.',
      'A continuidade do uso dos serviços após a publicação de alterações implica a aceitação da nova versão.',
    ],
  },
  {
    title: '13. Legislação e foro',
    paragraphs: [
      'Esta Política é regida pela legislação brasileira, em especial pela Lei nº 13.709/2018 (LGPD), pelo Código de Defesa do Consumidor (Lei nº 8.078/1990) e pelo Marco Civil da Internet (Lei nº 12.965/2014). Fica eleito o foro da comarca de [cidade/UF] para dirimir eventuais controvérsias, sem prejuízo das competências da Autoridade Nacional de Proteção de Dados (ANPD).',
      'Para dúvidas, reclamações ou exercício de direitos, contate o Encarregado pelos canais indicados na seção 11 desta Política.',
    ],
  },
]

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="07/08/2026">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-base sm:text-lg font-semibold text-text mb-3">{section.title}</h2>

          {section.paragraphs?.map((paragraph, i) => (
            <p key={i} className="mb-3">
              {paragraph}
            </p>
          ))}

          {section.items && (
            <ul className="space-y-2 list-disc pl-5">
              {section.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}

          {section.table && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60">
                    {section.table.cols.map((col) => (
                      <th key={col} className="px-3 py-2.5 text-left font-semibold text-text whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2.5 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </LegalLayout>
  )
}
