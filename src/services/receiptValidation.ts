import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../types/receipt'

export interface ValidationResult {
  valid: boolean
  error?: string
}

export const receiptValidation = {
  validateFile(file: File): ValidationResult {
    if (!file) {
      return { valid: false, error: 'Arquivo obrigatório' }
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Formato inválido. Permitidos: JPG, PNG, PDF.',
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      const maxMB = MAX_FILE_SIZE / 1024 / 1024
      return {
        valid: false,
        error: `Arquivo muito grande. Máximo permitido: ${maxMB}MB.`,
      }
    }

    return { valid: true }
  },

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
      reader.readAsDataURL(file)
    })
  },

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  },
}
