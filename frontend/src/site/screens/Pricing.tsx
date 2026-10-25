import { ArrowRight, CalendarDays, Check, GraduationCap, MapPin, Megaphone, School } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BillingPlans } from '../billing-types'
import PricingTable from '../components/PricingTable'
import CampusDemoEntry from '../components/CampusDemoEntry'
import { useApi } from '../state'
import '../pricing.css'
import { useI18n } from '../i18n'

export default function Pricing() {
  const { t } = useI18n()
  const plans = useApi<BillingPlans>('/billing/plans')

  return (
    <div className="page pricing-page">
      <header className="pricing-hero">
        <div>
          <span className="eyebrow">{t("QADAM · ТАРИФЫ")}</span>
          <h1>{t("Большие идеи.")}<br /><span>{t("Понятный первый шаг.")}</span></h1>
          <p>{t("Публикуй проекты и события, находи своих людей. Здесь — условия размещений и планируемые цены на отдельное продвижение.")}</p>
          <div className="pricing-hero-actions">
            <Link to="/create" className="btn lime lg">{plans.data?.pilotFree ? t("Создать бесплатно") : t("Создать публикацию")} <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#campus-offer" className="btn outline lg">{t("Для университетов")}</a>
          </div>
        </div>
        <div className="pricing-hero-art" aria-hidden="true"><MapPin size={62} strokeWidth={1.5} /><i /><span>{t("ОТ ИДЕИ")}<br />{t("К ПЕРВОМУ ШАГУ")}</span></div>
      </header>

      {plans.loading && !plans.data && <section className="panel pricing-loading" aria-live="polite"><p role="status">{t("Загружаем условия публикаций…")}</p></section>}
      {plans.error && (
        <div className="pricing-error" role="alert">
          <div><strong>{t(plans.data ? 'Не удалось обновить тарифы.' : 'Не удалось загрузить тарифы.')}</strong><p>{t(plans.error)}{plans.data ? ` ${t('Ниже показаны последние загруженные условия.')}` : ''}</p></div>
          <button className="btn outline" onClick={plans.retry} disabled={plans.loading}>{t("Повторить")}</button>
        </div>
      )}

      {plans.data && <PublicationPricing plans={plans.data} />}

      <section className="panel pricing-campus" id="campus-offer" aria-labelledby="campus-title">
        <div className="pricing-campus-heading">
          <span className="pricing-campus-icon" aria-hidden="true"><School size={34} /></span>
          <div><span className="eyebrow">{t("QADAM CAMPUS · ДЛЯ ВУЗОВ")}</span><h2 id="campus-title">{t("Свой университет.")}<br />{t("Своё пространство.")}</h2></div>
        </div>
        <p className="pricing-campus-intro">{t("Кабинет подключённого университета объединяет подтверждение студентов, управление публикациями, выдачу пакетов услуг и статистику активности. Студенты сами выбирают, какие встречи, мероприятия, подработки и идеи разместить в пространстве Campus на общей карте.")}</p>
        <Link to="/campus" className="btn lime">{t("Открыть кабинет Campus")} <ArrowRight size={18} aria-hidden="true" /></Link>
        <CampusDemoEntry />
        <div className="pricing-campus-features">
          <div><MapPin size={22} aria-hidden="true" /><h3>{t("Пространство на карте")}</h3><p>{t("Встречи, мероприятия, подработки и идеи кампуса в одном месте.")}</p></div>
          <div><School size={22} aria-hidden="true" /><h3>{t("Управление и статистика")}</h3><p>{t("Подтверждай заявки студентов, управляй видимостью публикаций и следи за активностью своего вуза.")}</p></div>
          <div><GraduationCap size={22} aria-hidden="true" /><h3>{t("Университет оплачивает")}</h3><p>{t("Включённые в его пакет услуги будут бесплатны студентам. Повторной оплаты за них не будет.")}</p></div>
        </div>
        <div className="pricing-campus-terms"><strong>{t("Стоимость согласуется отдельно")}</strong><p>{t("Возможные форматы для вузов: разовая настройка, месячная или годовая подписка, вузовские пакеты услуг для студентов. Состав, объём и цена пока не определены.")}</p></div>
      </section>
    </div>
  )
}

function PublicationPricing({ plans }: { plans: BillingPlans }) {
  const { t } = useI18n()
  return (
    <>
      {plans.pilotFree && (
        <aside className="pricing-pilot" aria-labelledby="pricing-pilot-title">
          <span className="pricing-pilot-badge"><Check size={15} aria-hidden="true" /> {t("Бесплатный пилот")}</span>
          <div><h2 id="pricing-pilot-title">{t("Сейчас все публикации бесплатны")}</h2><p>{t("В таблице — планируемые цены после пилота.")} {plans.paymentAvailable ? t("О переходе к платным размещениям сообщим отдельно.") : t("Оплата пока недоступна, списаний нет.")}</p></div>
        </aside>
      )}

      <section className="pricing-section" aria-labelledby="pricing-table-title">
        <div className="pricing-section-heading"><span className="eyebrow">{t("01 / ПУБЛИКАЦИИ И ПРОДВИЖЕНИЕ")}</span><h2 id="pricing-table-title">{t("Первая публикация месяца — бесплатно")}</h2><p>{t("Для всех пользователей. Дополнительные размещения и продвижение — по отдельным условиям.")}</p></div>
        {!plans.pilotFree && !plans.paymentAvailable && <p className="pricing-availability" role="status">{t("Оплата дополнительных публикаций и продвижения пока недоступна.")}</p>}
        <p className="pricing-availability">{t("Продвижение пока не активируется. Сейчас доступны цены и расчёт стоимости; обычную публикацию можно создать без продвижения.")}</p>
        <PricingTable plans={plans} />
        <div className="pricing-rules">
          <article><CalendarDays size={24} aria-hidden="true" /><h3>{t("Каждый месяц — новый старт")}</h3><p>{t('Бесплатный лимит обновляется в начале календарного месяца по времени Казахстана ({timezone}). Это не подписка: автоматических ежемесячных списаний нет.', {timezone:plans.timezone})}</p></article>
          <article><GraduationCap size={24} aria-hidden="true" /><h3>{t("Студенческий статус подтверждается")}</h3><p>{t("Подтверждение выдаёт администратор QADAM или университет. Скидка применяется к подтверждённому аккаунту; сравнение тарифов не меняет статус пользователя.")}</p></article>
          <article><Megaphone size={24} aria-hidden="true" /><h3>{t("Продвижение — по желанию")}</h3><p>{t('Планируется разовая услуга на {short} или {long} дней, отдельно от публикации. Активация пока недоступна.', {short:plans.promotion3.days,long:plans.promotion7.days})}</p></article>
        </div>
      </section>
    </>
  )
}
