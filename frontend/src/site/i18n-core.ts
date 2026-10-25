export type Language = 'ru' | 'kk' | 'en'
export type TranslationCatalog = Record<string, { kk: string; en: string }>
export type MessageParams = Record<string, string | number>

export function normalizeLanguage(value: string | null | undefined): Language {
  return value === 'kk' || value === 'en' ? value : 'ru'
}

export function localeFor(language: Language) {
  return { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB' }[language]
}

export function translateMessage(catalog: TranslationCatalog, language: Language, source: string, params: MessageParams = {}) {
  const message = language === 'ru' ? source : catalog[source]?.[language] ?? source
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(params, key) ? String(params[key]) : placeholder)
}
