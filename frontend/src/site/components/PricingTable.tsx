import { useId } from 'react'
import type { BillingPlans } from '../billing-types'
import '../pricing.css'
import { useI18n } from '../i18n'

export default function PricingTable({ plans }: { plans: BillingPlans }) {
  const { t, locale } = useI18n()
  const id = useId()
  const captionId = `${id}-caption`
  const noteId = `${id}-note`
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: plans.currency, maximumFractionDigits: 0 })
  const rows = [
    { title: plans.publication.freePerMonth === 1 ? t('Первая публикация месяца') : t('Бесплатные публикации месяца: {count}', {count:plans.publication.freePerMonth}), detail: t('Лимит обновляется каждый календарный месяц'), free: true },
    { title: t('Каждая следующая публикация'), detail: t('Разовое размещение'), regular: plans.publication.regular, student: plans.publication.student },
    { title: t('Продвижение на {days} дн.', {days:plans.promotion3.days}), detail: t('Отдельная необязательная услуга'), regular: plans.promotion3.regular, student: plans.promotion3.student },
    { title: t('Продвижение на {days} дн.', {days:plans.promotion7.days}), detail: t('Отдельная необязательная услуга'), regular: plans.promotion7.regular, student: plans.promotion7.student },
  ]

  return (
    <div className="pricing-table-block">
      <p id={noteId} className="pricing-table-note"> {t("* Студенческий тариф применяется после подтверждения статуса администратором QADAM или университетом.")} </p>
      <div className="pricing-table-scroll" role="region" aria-labelledby={captionId} aria-describedby={noteId} tabIndex={0}>
        <table className="pricing-table">
          <caption id={captionId}>{plans.pilotFree ? t("Планируемые цены после бесплатного пилота") : t("Цены на публикации и продвижение")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Услуга")}</th>
              <th scope="col"><span className="pricing-header-full">{t("Обычный тариф")}</span><span className="pricing-header-short" aria-hidden="true">{t("Обычный")}</span></th>
              <th scope="col" className="pricing-student-col"><span className="pricing-header-full">{t("Подтверждённый студент")}</span><span className="pricing-header-short" aria-hidden="true">{t("Студент*")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.title}>
                <th scope="row"><strong>{row.title}</strong><span>{row.detail}</span></th>
                <td className={row.free ? 'pricing-free' : ''}>{row.free ? t("Бесплатно") : money.format(row.regular!)}</td>
                <td className={`pricing-student-col${row.free ? ' pricing-free' : ''}`}>{row.free ? t("Бесплатно") : money.format(row.student!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
