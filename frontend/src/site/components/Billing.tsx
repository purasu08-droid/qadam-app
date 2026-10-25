import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, GraduationCap, Sparkles } from 'lucide-react'
import { useApi } from '../state'
import { formatTenge, publicationPriceText, type BillingAccount, type BillingQuote } from '../billing'
import type { BillingPlans } from '../billing-types'
import { useI18n } from '../i18n'

export function PublicationBilling({ quote, error, retry }: { quote: BillingQuote | null; error: string | null; retry: () => void }) {
  const { t } = useI18n()
  return <section className="panel billing-summary" aria-label={t("Стоимость публикации")}>
    <div className="row between"><h2>{t("Стоимость публикации")}</h2><Link to="/pricing" className="link-purple">{t("Тарифы")} <ArrowRight size={16} /></Link></div>
    {error ? <p className="err" role="alert">{t("Не удалось проверить условия.")} {t(error)} <button type="button" className="link-purple" onClick={retry}>{t("Повторить")}</button></p> : !quote ? <p role="status" className="muted">{t("Проверяем бесплатную публикацию и пакет вуза…")}</p> : <>
      <p className="billing-price" role="status">{publicationPriceText(quote)}</p>
      <p className="muted">{quote.studentVerified ? <><GraduationCap size={16} /> {t("Студенческий тариф подтверждён")}</> : t("Обычный тариф. Студенческий применяется после подтверждения администрацией или вузом.")}</p>
      {quote.pilotFree && <div className="billing-pilot"><Check size={18} /><div><b>{t("Сейчас все публикации бесплатны.")}</b><p>{t("Мы проверяем модель на пилоте. Деньги не списываются.")}</p></div></div>}
      <p className="small muted">{quote.freeRemaining > 0 ? t("Первая бесплатная публикация этого месяца ещё доступна.") : t('В этом месяце опубликовано: {count}. Бесплатная публикация обновится в следующем календарном месяце.', {count:quote.usedPublications})}</p>
      {quote.pilotFree && <p className="small muted">{t("Расчёт по тарифам после пилота:")} {quote.expectedSource === 'monthly_free' ? t("первая публикация месяца — бесплатно.") : quote.expectedSource === 'campus' ? t("публикацию покрыл бы пакет вуза, доплачивать не нужно.") : t('{amount} за эту публикацию.', {amount:formatTenge(quote.expectedAmount)})}</p>}
      {!quote.canPublish && <p className="err" role="status">{t("Для этой публикации нужна оплата. Платёж пока недоступен — сохрани черновик, чтобы вернуться позже.")}</p>}
      <p className="small muted">{t("Продвижение оплачивается отдельно и не требуется для публикации. Автоматической подписки нет.")}</p>
    </>}
    <button type="button" className="link-purple" onClick={retry}>{t("Обновить расчёт")}</button>
  </section>
}

export function AccountBilling() {
  const { t } = useI18n()
  const account = useApi<BillingAccount>('/billing/me')
  return <section className="panel billing-summary account-billing" aria-label={t("Тариф и бесплатные публикации")}>
    <div className="row between"><h2>{t("Твой тариф")}</h2><Link to="/pricing" className="link-purple">{t("Условия")} <ArrowRight size={16} /></Link></div>
    {account.error ? <p className="err" role="status">{t(account.error)} <button type="button" className="link-purple" onClick={account.reload}>{t("Повторить")}</button></p> : !account.data ? <p className="muted" role="status">{t("Загружаем условия…")}</p> : <>
      <p><b>{account.data.studentVerified ? t("Студенческий — подтверждён") : t("Обычный пользователь")}</b></p>
      {!account.data.studentVerified && <p className="muted small">{t("Статус студента подтверждает администрация или вуз. Поле «Роль» в профиле не меняет тариф.")}</p>}
      {account.data.pilotFree && <p className="billing-pilot"><Check size={18} /> {t("В пилоте все публикации бесплатны.")}</p>}
      <p className="muted small">{t('Опубликовано в этом месяце: {used}. Бесплатных по базовому тарифу осталось: {remaining}.', {used:account.data.usedPublications,remaining:account.data.freeRemaining})}</p>
      {account.data.campus.some((grant) => grant.remaining > 0) && <div className="billing-campus-credit"><h3>{t("Пакет твоего вуза")}</h3><ul>{account.data.campus.filter((grant) => grant.remaining > 0).map((grant, index) => <li key={`${grant.service}-${grant.expiresAt}-${index}`}>{grant.service === 'publication' ? t("Публикации") : grant.service === 'promotion3' ? t("Продвижение на 3 дня") : t("Продвижение на 7 дней")}: {grant.remaining}</li>)}</ul><p className="small muted">{t("Услуги покрываются пакетом вуза. Доплаты со студента нет. В пилоте пакет сохраняется.")}</p></div>}
    </>}
  </section>
}

export function PromotionPreview({ opportunityId }: { opportunityId: string }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<0 | 3 | 7>(0)
  const three = useApi<BillingQuote>(`/billing/quote?service=promotion3&opportunityId=${encodeURIComponent(opportunityId)}`)
  const seven = useApi<BillingQuote>(`/billing/quote?service=promotion7&opportunityId=${encodeURIComponent(opportunityId)}`)
  const quote = selected === 3 ? three.data : selected === 7 ? seven.data : null
  const error = three.error ?? seven.error
  const price = (q: BillingQuote | null) => q ? q.campusCovered ? t('Из пакета вуза') : formatTenge(q.expectedAmount) : t('Загрузка…')
  return <section className="panel billing-summary" aria-label={t("Добровольное продвижение")}>
    <h2><Sparkles size={20} /> {t("Продвижение")}</h2>
    <p className="muted small">{t("Необязательная отдельная услуга. Предварительный расчёт для твоего тарифа.")}</p>
    <fieldset className="promotion-options"><legend className="sr-only">{t("Срок продвижения")}</legend>
      <label><input type="radio" name={`promotion-${opportunityId}`} checked={selected === 0} onChange={() => setSelected(0)} /><span><b>{t("Без продвижения")}</b><small>{t("Публикация остаётся на карте")}</small></span></label>
      <label><input type="radio" name={`promotion-${opportunityId}`} checked={selected === 3} onChange={() => setSelected(3)} /><span><b>{t("На 3 дня")}</b><small>{price(three.data)}</small></span></label>
      <label><input type="radio" name={`promotion-${opportunityId}`} checked={selected === 7} onChange={() => setSelected(7)} /><span><b>{t("На 7 дней")}</b><small>{price(seven.data)}</small></span></label>
    </fieldset>
    {error && <p className="err" role="status">{t(error)} <button type="button" className="link-purple" onClick={() => { three.reload(); seven.reload() }}>{t("Повторить расчёт")}</button></p>}
    {quote && <p role="status">{quote.campusCovered ? t("Услуга покрывается пакетом вуза. Доплаты нет.") : t('Стоимость по тарифу: {amount}. Разовая оплата, без подписки.', {amount:formatTenge(quote.expectedAmount)})}</p>}
    <p className="small muted">{t("Запуск продвижения пока недоступен. Выбор срока ничего не активирует и не списывает деньги.")}</p>
    <Link to="/pricing" className="link-purple">{t("Все условия")} <ArrowRight size={16} /></Link>
  </section>
}

export function PricingTeaser() {
  const { t } = useI18n()
  const plans = useApi<BillingPlans>('/billing/plans')
  return <section className="sec panel pricing-teaser" aria-label={t("Тарифы QADAM")}>
    <div><span className="eyebrow">{t("ПОНЯТНЫЕ УСЛОВИЯ")}</span><h2>{t("Первый шаг — бесплатно")}</h2><p className="sec-sub">{plans.data?.pilotFree ? t("В пилоте все публикации бесплатны. Сравни будущие тарифы и условия для студентов.") : t("Первая публикация каждого месяца бесплатна. Продвижение — только по желанию.")}</p></div>
    <Link to="/pricing" className="btn outline-purple">{t("Тарифы и Qadam Campus")} <ArrowRight size={18} /></Link>
  </section>
}
