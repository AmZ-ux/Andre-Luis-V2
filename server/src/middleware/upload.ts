import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../data/uploads')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })

export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.bin'
    cb(null, `${uuid()}${ext}`)
  },
})

export const uploadReceipt = multer({
  storage,
  limits: { fileSize: MAX_RECEIPT_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) return cb(null, true)
    cb(new Error('Tipo de arquivo não permitido (use JPG, PNG ou PDF)'))
  },
})