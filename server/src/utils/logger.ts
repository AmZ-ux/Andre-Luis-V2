import pino from 'pino'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const transport = process.env.NODE_ENV === 'production'
  ? pino.transport({
      targets: [
        { target: 'pino/file', options: { destination: path.resolve(__dirname, '../../logs/app.log'), mkdir: true } },
        { target: 'pino/file', options: { destination: 1 } },
      ],
    })
  : pino.transport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    })

export const logger = pino(
  { level: process.env.LOG_LEVEL || 'info', name: 'transporte-andre-luis' },
  transport,
)
