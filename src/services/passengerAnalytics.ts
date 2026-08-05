import { config } from '../config'
import { realReports } from './realApi'
import type { PassengerReportData } from '../types/reports'
import type { Passenger } from '../types/passenger'

function loadPassengers(): Passenger[] {
  const stored = localStorage.getItem('mock_passengers')
  return stored ? JSON.parse(stored) : []
}

const TYPE_LABELS: Record<string, string> = {
  university: 'Universitário', school: 'Escolar', contract: 'Contrato',
}

function typeLabel(type?: string): string {
  return TYPE_LABELS[type || ''] || type || 'outros'
}

export const passengerAnalytics = {
  async getReportData(): Promise<PassengerReportData> {
    if (config.realApi) {
      const overview = await realReports.overview()
      const p = overview.passengers
      return {
        ativos: p.ativos,
        inativos: p.inativos,
        ferias: p.ferias,
        bloqueados: p.bloqueados,
        total: p.total,
        byCity: p.byCity,
        byInstitution: p.byInstitution,
        byCompany: p.byCompany,
        byTransportType: p.byTransportType,
      }
    }

    const passengers = loadPassengers()

    const ativos = passengers.filter((p) => p.status === 'active').length
    const inativos = passengers.filter((p) => p.status === 'inactive').length
    const ferias = passengers.filter((p) => p.status === 'vacation').length
    const bloqueados = passengers.filter((p) => p.status === 'blocked').length

    const cityMap = new Map<string, number>()
    passengers.forEach((p) => {
      cityMap.set(p.address.city, (cityMap.get(p.address.city) || 0) + 1)
    })
    const byCity = Array.from(cityMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const instMap = new Map<string, number>()
    passengers.forEach((p) => {
      if (p.institution) instMap.set(p.institution, (instMap.get(p.institution) || 0) + 1)
    })
    const byInstitution = Array.from(instMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const companyMap = new Map<string, number>()
    passengers.forEach((p) => {
      if (p.company) companyMap.set(p.company, (companyMap.get(p.company) || 0) + 1)
    })
    const byCompany = Array.from(companyMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const typeLabels: Record<string, string> = {
      university: 'Universitário', school: 'Escolar', contract: 'Contrato',
    }
    const typeMap = new Map<string, number>()
    passengers.forEach((p) => {
      const label = typeLabels[p.transportType] || p.transportType
      typeMap.set(label, (typeMap.get(label) || 0) + 1)
    })
    const byTransportType = Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    return {
      ativos, inativos, ferias, bloqueados,
      total: passengers.length,
      byCity, byInstitution, byCompany, byTransportType,
    }
  },

  async generateReport(type: 'active' | 'inactive' | 'vacation' | 'city' | 'institution' | 'company' | 'transportType'): Promise<{
    title: string
    chartData: Record<string, unknown>[]
    tableData: Record<string, unknown>[]
  }> {
    if (config.realApi) {
      const overview = await realReports.overview()
      const data = overview.passengers
      const passengers: any[] = overview.passengers.passengers || []

      if (type === 'active') {
        const active = passengers.filter((p) => p.status === 'active')
        return {
          title: 'Passageiros Ativos',
          chartData: data.byCity,
          tableData: active.map((p) => ({
            nome: p.name, cpf: p.cpf, cidade: p.city || '',
            tipo: typeLabel(p.transportType),
            instituicao: p.institution || '-', empresa: p.company || '-',
          })),
        }
      }

      const map: Record<string, { title: string; data: any[] }> = {
        city: { title: 'Passageiros por Cidade', data: data.byCity },
        institution: { title: 'Passageiros por Instituição', data: data.byInstitution },
        company: { title: 'Passageiros por Empresa', data: data.byCompany },
        transportType: { title: 'Passageiros por Tipo de Transporte', data: data.byTransportType },
      }
      const entry = map[type]
      if (entry) {
        return { title: entry.title, chartData: entry.data, tableData: entry.data }
      }

      return { title: 'Relatório de Passageiros', chartData: [], tableData: [] }
    }

    const data = await this.getReportData()
    const passengers = loadPassengers()

    if (type === 'active') {
      const active = passengers.filter((p) => p.status === 'active')
      return {
        title: 'Passageiros Ativos',
        chartData: data.byCity,
        tableData: active.map((p) => ({
          nome: p.name, cpf: p.cpf, cidade: p.address.city,
          tipo: p.transportType === 'university' ? 'Universitário' : p.transportType === 'school' ? 'Escolar' : 'Contrato',
          instituicao: p.institution || '-', empresa: p.company || '-',
        })),
      }
    }

    if (type === 'city') {
      return {
        title: 'Passageiros por Cidade',
        chartData: data.byCity,
        tableData: data.byCity,
      }
    }

    if (type === 'institution') {
      return {
        title: 'Passageiros por Instituição',
        chartData: data.byInstitution,
        tableData: data.byInstitution,
      }
    }

    if (type === 'transportType') {
      return {
        title: 'Passageiros por Tipo de Transporte',
        chartData: data.byTransportType,
        tableData: data.byTransportType,
      }
    }

    return { title: 'Relatório de Passageiros', chartData: [], tableData: [] }
  },
}
