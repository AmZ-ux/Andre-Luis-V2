import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  formatCPF,
  formatPhone,
  formatCEP,
  isValidCPF,
  stateOptions,
  transportTypeOptions,
  paymentMethodOptions,
  statusOptions,
} from '../../validators/passengerValidators'
import type { Passenger, PassengerFormData, PassengerStatus, TransportType, PaymentMethod } from '../../types/passenger'
import { useToast } from '../../contexts/ToastContext'

interface PassengerFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Omit<Passenger, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  editPassenger?: Passenger | null
}

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function FormSection({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-sm font-semibold text-text"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}

const emptyForm: PassengerFormData = {
  name: '', cpf: '', rg: '', birthDate: '', phone: '', whatsapp: '', email: '',
  zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: 'SP',
  transportType: 'university', institution: '', course: '', class: '', company: '', school: '', workplace: '',
  pickupPoint: '', destination: '', contractStartDate: '',
  monthlyFee: '', dueDay: '', paymentMethod: 'pix', status: 'active', notes: '',
}

export function PassengerForm({ isOpen, onClose, onSave, editPassenger }: PassengerFormProps) {
  const { addToast } = useToast()
  const [form, setForm] = useState<PassengerFormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof PassengerFormData, string>>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editPassenger) {
      setForm({
        name: editPassenger.name, cpf: editPassenger.cpf, rg: editPassenger.rg || '',
        birthDate: editPassenger.birthDate, phone: editPassenger.phone,
        whatsapp: editPassenger.whatsapp || '', email: editPassenger.email,
        zipCode: editPassenger.address.zipCode, street: editPassenger.address.street,
        number: editPassenger.address.number, complement: editPassenger.address.complement || '',
        neighborhood: editPassenger.address.neighborhood, city: editPassenger.address.city,
        state: editPassenger.address.state,
        transportType: editPassenger.transportType, institution: editPassenger.institution || '',
        course: editPassenger.course || '', class: editPassenger.class || '',
        company: editPassenger.company || '', school: editPassenger.school || '',
        workplace: editPassenger.workplace || '',
        pickupPoint: editPassenger.pickupPoint || '', destination: editPassenger.destination || '',
        contractStartDate: editPassenger.contractStartDate || '',
        monthlyFee: String(editPassenger.monthlyFee), dueDay: String(editPassenger.dueDay),
        paymentMethod: editPassenger.paymentMethod, status: editPassenger.status,
        notes: editPassenger.notes || '',
      })
    } else {
      setForm(emptyForm)
    }
    setErrors({})
  }, [editPassenger, isOpen])

  const handleChange = (field: keyof PassengerFormData, value: string) => {
    let formatted = value
    if (field === 'cpf') formatted = formatCPF(value)
    else if (field === 'phone' || field === 'whatsapp') formatted = formatPhone(value)
    else if (field === 'zipCode') formatted = formatCEP(value)
    else if (field === 'monthlyFee' || field === 'dueDay') formatted = value.replace(/\D/g, '')

    setForm((prev) => ({ ...prev, [field]: formatted }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Nome obrigatório'
    if (!form.cpf.trim()) errs.cpf = 'CPF obrigatório'
    else if (!isValidCPF(form.cpf)) errs.cpf = 'CPF inválido'
    if (!form.phone.trim()) errs.phone = 'Telefone obrigatório'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'
    const fee = parseFloat(form.monthlyFee)
    if (!form.monthlyFee || isNaN(fee) || fee <= 0) errs.monthlyFee = 'Valor deve ser maior que zero'
    const day = parseInt(form.dueDay)
    if (!form.dueDay || isNaN(day) || day < 1 || day > 31) errs.dueDay = 'Informe um dia entre 1 e 31'
    if (!form.city.trim()) errs.city = 'Cidade obrigatória'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      addToast('error', 'Verifique os campos obrigatórios')
      return
    }

    setSaving(true)
    try {
      await onSave({
        name: form.name, cpf: form.cpf, rg: form.rg || undefined,
        birthDate: form.birthDate, phone: form.phone, whatsapp: form.whatsapp || undefined,
        email: form.email,
        address: {
          zipCode: form.zipCode, street: form.street, number: form.number,
          complement: form.complement || undefined, neighborhood: form.neighborhood,
          city: form.city, state: form.state,
        },
        transportType: form.transportType as TransportType,
        institution: form.institution || undefined, course: form.course || undefined,
        class: form.class || undefined, company: form.company || undefined,
        school: form.school || undefined, workplace: form.workplace || undefined,
        pickupPoint: form.pickupPoint || undefined, destination: form.destination || undefined,
        contractStartDate: form.contractStartDate || undefined,
        monthlyFee: parseFloat(form.monthlyFee), dueDay: parseInt(form.dueDay),
        paymentMethod: form.paymentMethod as PaymentMethod,
        status: form.status as PassengerStatus, notes: form.notes || undefined,
      })
      onClose()
    } catch {
      addToast('error', 'Erro ao salvar passageiro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editPassenger ? 'Editar Passageiro' : 'Novo Passageiro'}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection title="Dados Pessoais">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome completo *" value={form.name} onChange={(e) => handleChange('name', e.target.value)} error={errors.name} placeholder="Nome do passageiro" />
            <Input label="CPF *" value={form.cpf} onChange={(e) => handleChange('cpf', e.target.value)} error={errors.cpf} placeholder="000.000.000-00" maxLength={14} />
            <Input label="RG" value={form.rg} onChange={(e) => handleChange('rg', e.target.value)} placeholder="RG" />
            <Input label="Data de nascimento" type="date" value={form.birthDate} onChange={(e) => handleChange('birthDate', e.target.value)} />
          </div>
        </FormSection>

        <FormSection title="Contato">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Telefone *" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} error={errors.phone} placeholder="(11) 99999-8888" />
            <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => handleChange('whatsapp', e.target.value)} placeholder="(11) 99999-8888" />
            <Input label="Email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} error={errors.email} placeholder="email@exemplo.com" className="sm:col-span-2" />
          </div>
        </FormSection>

        <FormSection title="Endereço">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="CEP" value={form.zipCode} onChange={(e) => handleChange('zipCode', e.target.value)} placeholder="00000-000" maxLength={9} />
            <Input label="Rua" value={form.street} onChange={(e) => handleChange('street', e.target.value)} className="sm:col-span-2" />
            <Input label="Número" value={form.number} onChange={(e) => handleChange('number', e.target.value)} />
            <Input label="Complemento" value={form.complement} onChange={(e) => handleChange('complement', e.target.value)} />
            <Input label="Bairro" value={form.neighborhood} onChange={(e) => handleChange('neighborhood', e.target.value)} />
            <Input label="Cidade *" value={form.city} onChange={(e) => handleChange('city', e.target.value)} error={errors.city} />
            <Select label="Estado" options={stateOptions} value={form.state} onChange={(e) => handleChange('state', e.target.value)} />
          </div>
        </FormSection>

        <FormSection title="Informações do Transporte">
          <Select label="Tipo" options={transportTypeOptions} value={form.transportType} onChange={(e) => handleChange('transportType', e.target.value)} />
          {form.transportType === 'university' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Universidade" value={form.institution} onChange={(e) => handleChange('institution', e.target.value)} />
              <Input label="Curso" value={form.course} onChange={(e) => handleChange('course', e.target.value)} />
            </div>
          )}
          {form.transportType === 'school' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Escola" value={form.school} onChange={(e) => handleChange('school', e.target.value)} />
              <Input label="Turma" value={form.class} onChange={(e) => handleChange('class', e.target.value)} />
            </div>
          )}
          {form.transportType === 'contract' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Empresa" value={form.company} onChange={(e) => handleChange('company', e.target.value)} />
              <Input label="Local de trabalho" value={form.workplace} onChange={(e) => handleChange('workplace', e.target.value)} />
            </div>
          )}
        </FormSection>

        <FormSection title="Trajeto do Contrato">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Ponto de saída" value={form.pickupPoint} onChange={(e) => handleChange('pickupPoint', e.target.value)} placeholder="Ex.: Terminal Central" />
            <Input label="Destino" value={form.destination} onChange={(e) => handleChange('destination', e.target.value)} placeholder="Ex.: USP - Cidade Universitária" />
            <Input label="Data de início do contrato" type="date" value={form.contractStartDate} onChange={(e) => handleChange('contractStartDate', e.target.value)} className="sm:col-span-2" />
          </div>
        </FormSection>

        <FormSection title="Informações Financeiras">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Valor da mensalidade *" value={form.monthlyFee} onChange={(e) => handleChange('monthlyFee', e.target.value)} error={errors.monthlyFee} placeholder="0,00" />
            <Input label="Dia do vencimento *" value={form.dueDay} onChange={(e) => handleChange('dueDay', e.target.value)} error={errors.dueDay} placeholder="1-31" maxLength={2} />
            <Select label="Forma de pagamento" options={paymentMethodOptions} value={form.paymentMethod} onChange={(e) => handleChange('paymentMethod', e.target.value)} />
          </div>
        </FormSection>

        <FormSection title="Status">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Status" options={statusOptions} value={form.status} onChange={(e) => handleChange('status', e.target.value)} />
          </div>
        </FormSection>

        <FormSection title="Observações" defaultOpen={false}>
          <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Observações sobre o passageiro..." />
        </FormSection>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {editPassenger ? 'Salvar alterações' : 'Cadastrar passageiro'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
