import React, { type ErrorInfo, type ReactNode } from 'react'

const COPY = {
  ru: {
    title: 'Не удалось открыть страницу',
    description: 'Попробуй обновить страницу. Сохранённые черновики не удаляются.',
    reload: 'Обновить страницу',
  },
  kk: {
    title: 'Бетті ашу мүмкін болмады',
    description: 'Бетті жаңартып көр. Сақталған нобайлар өшірілмейді.',
    reload: 'Бетті жаңарту',
  },
  en: {
    title: 'Could not open the page',
    description: 'Try reloading the page. Saved drafts are not deleted.',
    reload: 'Reload page',
  },
}

/** Keep the recovery screen independent of application providers and styles. */
export function ScreenErrorFallback() {
  const html = typeof document === 'undefined' ? undefined : document.documentElement
  const language = html?.lang === 'kk' || html?.lang === 'en' ? html.lang : 'ru'
  const copy = COPY[language]
  const light = html?.dataset.theme === 'light'
  const palette = light
    ? { background: '#f3f5f9', panel: '#ffffff', ink: '#111114', muted: '#6e7483', line: '#dce0e9', blue: '#3b5bf6', onBlue: '#ffffff' }
    : { background: '#0a0912', panel: '#17181f', ink: '#f4f5fa', muted: '#adb2c3', line: '#383c4b', blue: '#98a9ff', onBlue: '#10152d' }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24, boxSizing: 'border-box', colorScheme: light ? 'light' : 'dark', background: palette.background, color: palette.ink, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <section role="alert" aria-labelledby="qadam-screen-error-title" style={{ width: '100%', maxWidth: 460, padding: 28, boxSizing: 'border-box', border: `1px solid ${palette.line}`, borderRadius: 18, background: palette.panel }}>
        <h1 id="qadam-screen-error-title" style={{ margin: 0, fontSize: 24, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{copy.title}</h1>
        <p style={{ margin: '14px 0 24px', color: palette.muted, fontSize: 15, lineHeight: 1.6 }}>{copy.description}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, maxWidth: '100%', padding: '12px 20px', border: 0, borderRadius: 12, background: palette.blue, color: palette.onBlue, font: 'inherit', fontWeight: 600, cursor: 'pointer', overflowWrap: 'anywhere' }}>{copy.reload}</button>
      </section>
    </main>
  )
}

export default class ScreenErrorBoundary extends React.Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('QADAM screen render failed', error, info.componentStack)
  }

  render() {
    return this.state.failed ? <ScreenErrorFallback /> : this.props.children
  }
}
