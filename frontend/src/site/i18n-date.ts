import { localeFor, type Language } from './i18n-core'

const MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
const SHORT_MONTHS = ['қаң.', 'ақп.', 'нау.', 'сәу.', 'мам.', 'мау.', 'шіл.', 'там.', 'қыр.', 'қаз.', 'қар.', 'жел.']
const WEEKDAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі']
const SHORT_WEEKDAYS = ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сб']
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIME_PARTS = new Set(['hour', 'minute', 'second', 'fractionalSecond', 'dayPeriod', 'timeZoneName'])

/** Kazakh names remain available in browsers whose ICU lacks kk-KZ calendar data. */
export function formatLocalizedDate(date: Date, language: Language, options: Intl.DateTimeFormatOptions): string {
  if (language !== 'kk') return new Intl.DateTimeFormat(localeFor(language), options).format(date)

  // Let Intl handle the calendar, clock and time zone; do not ask it for Kazakh names.
  const formatter = new Intl.DateTimeFormat('en-GB', { ...options, calendar: 'gregory', numberingSystem: 'latn' })
  const parts = formatter.formatToParts(date)
  const calendar = new Intl.DateTimeFormat('en-GB', {
    calendar: 'gregory', numberingSystem: 'latn', timeZone: options.timeZone,
    day: 'numeric', month: 'numeric', year: 'numeric', weekday: 'long',
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value
  const calendarValue = (type: string) => calendar.find((part) => part.type === type)?.value ?? ''
  const monthIndex = Number(calendarValue('month')) - 1
  const weekdayIndex = EN_WEEKDAYS.indexOf(calendarValue('weekday'))

  const monthStyle = options.month ?? (options.dateStyle === 'full' || options.dateStyle === 'long' ? 'long' : options.dateStyle === 'medium' ? 'short' : 'numeric')
  const weekdayStyle = options.weekday ?? 'long'
  let month = value('month')
  if (month && monthStyle === 'long') month = MONTHS[monthIndex]
  else if (month && monthStyle === 'short') month = SHORT_MONTHS[monthIndex]
  else if (month && monthStyle === 'narrow') month = MONTHS[monthIndex].slice(0, 1).toUpperCase()
  let weekday = value('weekday')
  if (weekday) weekday = weekdayStyle === 'long' ? WEEKDAYS[weekdayIndex] : weekdayStyle === 'short' ? SHORT_WEEKDAYS[weekdayIndex] : WEEKDAYS[weekdayIndex].slice(0, 1).toUpperCase()

  const day = value('day')
  const year = value('year')
  const numericMonth = monthStyle === 'numeric' || monthStyle === '2-digit'
  const dateParts = [day, month, year].filter((part): part is string => part !== undefined)
  // Written dates use day–month–year; entirely numeric dates keep their requested widths.
  let dateText = dateParts.join(numericMonth && month ? '.' : ' ')
  if (year && !numericMonth) dateText += ' ж.'
  const era = value('era')
  if (era) dateText += `${dateText ? ' ' : ''}${/^B/i.test(era) ? 'б. з. д.' : 'б. з.'}`
  if (weekday) dateText = `${weekday}${dateText ? `, ${dateText}` : ''}`

  const firstTime = parts.findIndex((part) => TIME_PARTS.has(part.type))
  let lastTime = parts.length - 1
  while (lastTime >= 0 && !TIME_PARTS.has(parts[lastTime].type)) lastTime -= 1
  const timeText = firstTime < 0 ? '' : parts.slice(firstTime, lastTime + 1).map((part) => part.value).join('')
  return [dateText, timeText].filter(Boolean).join(', ')
}
