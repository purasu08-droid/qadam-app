import { Router } from 'express'
import { z } from 'zod'
import { me, requireAuth } from '../auth.js'
import { BILLING_SERVICES, billingMe, billingPlans, billingQuote } from '../billing.js'

export const billingRouter = Router()
billingRouter.get('/plans', (_req, res) => res.json(billingPlans()))
billingRouter.get('/me', requireAuth, (req, res) => res.json(billingMe(me(req))))
billingRouter.get('/quote', requireAuth, (req, res) => {
  const query = z.object({ service: z.enum(BILLING_SERVICES), opportunityId: z.string().min(1).max(100).optional() }).parse(req.query)
  res.json(billingQuote(me(req), query.service, { opportunityId: query.opportunityId }))
})
