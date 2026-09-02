# Pagamentos — Transporte André Luis

## Regra de Ouro

> **NÃO existe pagamento manual.** O status `paid` é resultado exclusivo de confirmação válida do gateway de pagamento (Mercado Pago) através de `finalizePayment()`.

## Fluxo de Pagamento

### PIX

```
1. Passageiro clica "Pagar com PIX" na UI
2. Frontend chama POST /api/payments/create
3. Servidor cria pix_charge (status: pending)
4. Servidor chama Mercado Pago API → criar pagamento PIX
5. Retorna QR Code + copia-e-cola para o frontend
6. Passageiro paga (fora do app)
7. Mercado Pago envia webhook → POST /api/payments/webhook
   OU polling detecta pagamento (a cada 10min)
8. finalizePayment() processa:
   - Cria registro em payments (entry_type: NORMAL ou OVERPAYMENT)
   - Atualiza monthly_fees.status = 'paid'
   - Atualiza pix_charges.status = 'paid'
   - Registra notificação
```

### Cartão

```
1. Passageiro clica "Pagar com Cartão"
2. Servidor cria preferência no Mercado Pago
3. Retorna link de pagamento hospedado
4. Passageiro paga no link do Mercado Pago
5. Mesmo fluxo de confirmação do PIX (webhook/polling)
```

## entry_type

| Tipo | Significado | Efeito |
|------|------------|--------|
| `NORMAL` | Pagamento exato ou suficiente | `monthly_fees.status = 'paid'` |
| `SUBPAYMENT` | Pagamento parcial (valor < esperado) | Fee continua `pending` |
| `OVERPAYMENT` | Pagamento excedente (valor > esperado) | Fee fica `paid`, excedente registrado |

## Webhook do Mercado Pago

### Endpoint

```
POST /api/payments/webhook
```

### Segurança

- **HMAC SHA-256**: header `x-signature` verificado contra `MERCADO_PAGO_WEBHOOK_SECRET`
- **Fail closed**: sem secret configurado, webhooks são rejeitados
- **Consulta reversa**: mesmo com assinatura válida, servidor consulta o pagamento no MP

### Processamento

```
Webhook recebido
  → Verificar assinatura HMAC
  → Extrair paymentId do query string
  → Chamar finalizePayment(paymentId)
      → Consultar pagamento no Mercado Pago (API)
      → Verificar status (approved/cancelled)
      → Processar conforme status
```

## Polling (Conciliação)

A cada 10 minutos, o scheduler verifica cobranças pendentes no Mercado Pago:

```
Scheduler (a cada 10min)
  → Buscar pix_charges com status 'pending'
  → Para cada cobrança, consultar status no MP
  → Se aprovado: finalizePayment()
  → Se expirado (>24h): marcar como 'expired'
```

## Proteções

| Proteção | Implementação |
|----------|--------------|
| Dedup de webhook | `external_payment_id + entry_type` é único |
| Pagamento duplicado | Verificação antes de inserir |
| Valor inválido | Rejeição de NaN, Infinity, <= 0 |
| Cobrança sem registro | Warning + processamento sem validação de valor |
| Fee já quitada | Overpayment registrado, alerta ao admin |
| Race condition | Índices únicos + transações |

## Subpaymente vs Overdue

O `markOverdueFees` do scheduler considera:

```sql
WHERE status = 'pending'
AND NOT EXISTS (
  SELECT 1 FROM payments
  WHERE payments.monthly_fee_id = monthly_fees.id
  AND payments.entry_type IN ('NORMAL', 'OVERPAYMENT')
)
```

- SUBPAYMENT **NÃO impede** marcação como overdue
- Somente NORMAL ou OVERPAYMENT quitam a fee

## Regras Administrativas

- Admin pode marcar fee como `cancelled` ou `exempt`
- Admin **NÃO** pode marcar fee como `paid`
- Pagamentos manuais históricos são exibidos, mas novos não podem ser criados
- Única exceção: `finalizePayment()` via gateway
