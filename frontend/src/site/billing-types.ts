/** Public price catalogue returned by GET /api/billing/plans. Amounts are in KZT. */
export type BillingPlans = {
  mode: 'preview' | 'enforced'
  pilotFree: boolean
  currency: 'KZT'
  timezone: string
  publication: { freePerMonth: number; regular: number; student: number }
  promotion3: { days: number; regular: number; student: number }
  promotion7: { days: number; regular: number; student: number }
  campus: { price: null; universityPaid: boolean }
  paymentAvailable: boolean
}
