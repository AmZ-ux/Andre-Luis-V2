import Stripe from 'stripe'
import { logger } from '../utils/logger.js'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY não configurada no servidor. Adicione a chave secreta (sk_live_... ou sk_test_...) no arquivo server/.env para habilitar PIX.'
    )
  }
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    logger.info('Stripe inicializado')
  }
  return stripe
}

export function webhookSecret(): string {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET não configurada no servidor. Configure o webhook do Stripe (evento payment_intent.succeeded) e adicione o segredo no arquivo server/.env.'
    )
  }
  return process.env.STRIPE_WEBHOOK_SECRET
}
