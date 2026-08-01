import { FileText } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ReceiptPreviewProps {
  fileData: string
  fileType: string
  fileName: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-32 w-32',
}

export function ReceiptPreview({ fileData, fileType, fileName, className, size = 'md' }: ReceiptPreviewProps) {
  const isImage = fileType.startsWith('image/')

  if (isImage) {
    return (
      <img
        src={fileData}
        alt={fileName}
        className={cn(
          'rounded-xl object-cover border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800',
          sizeMap[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center',
        sizeMap[size],
        className
      )}
    >
      <FileText className="h-6 w-6 text-gray-400" />
    </div>
  )
}
