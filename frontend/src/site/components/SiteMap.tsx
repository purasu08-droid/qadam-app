import { useEffect, useRef, useState, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L from 'leaflet'
import { LocateFixed, Minus, Plus, Sun, Moon } from 'lucide-react'
import { CITIES, KINDS, type Opportunity } from '../data'
import { KindIcon } from './ui'
import { useTheme } from '../theme'
import { useI18n } from '../i18n'
import { hasMapViewport, isMapCoordinate, mapZoom } from '../map-geometry'

// OSM-тайлы; тёмный режим — CSS-фильтр .dark-tiles (как в мобильной версии)
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const ICONS = Object.fromEntries(
  (Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => [k, renderToStaticMarkup(<KindIcon kind={k} size={20} />)]),
) as Record<keyof typeof KINDS, string>

function markerIcon(o: Opportunity, variant: 'pin' | 'square', selected: boolean) {
  const color = KINDS[o.kind].color
  if (variant === 'square')
    return L.divIcon({ html: `<div class="msq" style="--k:${color}"></div>`, className: '', iconSize: [22, 22], iconAnchor: [11, 11] })
  return L.divIcon({
    html: `<div class="mpin ${selected ? 'sel' : ''}" style="--k:${color}"><span>${ICONS[o.kind]}</span></div>`,
    className: '',
    iconSize: selected ? [64, 82] : [50, 64],
    iconAnchor: selected ? [32, 82] : [25, 64],
  })
}

type Props = {
  items: Opportunity[]
  center: [number, number]
  zoom?: number
  label?: string
  variant?: 'pin' | 'square'
  controls?: 'full' | 'zoom-left'
  selected?: string | null
  onSelect?: (o: Opportunity) => void
  popup?: (o: Opportunity) => ReactNode
}

export default function SiteMap({ items, center, zoom = 13, label, variant = 'pin', controls = 'full', selected = null, onSelect, popup }: Props) {
  const { t, language } = useI18n()
  const el = useRef<HTMLDivElement>(null)
  const popupEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const { theme, setTheme } = useTheme()
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null)
  const [mapRevision, setMapRevision] = useState(0)
  const viewCenter = isMapCoordinate(center) ? center : CITIES[0].coords
  const viewZoom = mapZoom(zoom)
  const currentView = useRef({ center: viewCenter, zoom: viewZoom })
  currentView.current = { center: viewCenter, zoom: viewZoom }
  const pendingView = useRef(false)
  const sel = items.find((o) => o.id === selected && isMapCoordinate(o.coords))

  const resetView = () => {
    const host = el.current
    const m = map.current
    if (!host || !m || !hasMapViewport(host.clientWidth, host.clientHeight)) return
    m.stop()
    m.invalidateSize({ pan: false })
    m.setView(currentView.current.center, currentView.current.zoom, { animate: false })
    pendingView.current = false
  }

  useEffect(() => {
    const host = el.current
    if (!host) return
    let frame = 0
    let disposed = false
    const syncSize = () => {
      if (disposed) return
      if (!hasMapViewport(host.clientWidth, host.clientHeight)) {
        map.current?.stop()
        return
      }
      if (!map.current) {
        const view = currentView.current
        const m = L.map(host, { zoomControl: false, scrollWheelZoom: controls === 'full' })
        m.setView(view.center, view.zoom, { animate: false })
        L.tileLayer(TILES, { attribution: '© OpenStreetMap', maxZoom: 19, className: 'dark-tiles' }).addTo(m)
        layer.current = L.layerGroup().addTo(m)
        map.current = m
        pendingView.current = false
        // Initial props effects may have run while CSS hid the map. Apply their layers now.
        setMapRevision((revision) => revision + 1)
      } else {
        map.current.invalidateSize({ pan: false })
        if (pendingView.current) resetView()
      }
    }
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncSize)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(host)
    if (host.parentElement) observer?.observe(host.parentElement)
    window.addEventListener('resize', resize)
    syncSize()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      map.current?.remove()
      map.current = null
      layer.current = null
    }
    // карта создаётся один раз; центр меняется эффектом ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    pendingView.current = true
    resetView()
  }, [viewCenter[0], viewCenter[1], viewZoom, sel?.id, mapRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const group = layer.current
    if (!group) return
    group.clearLayers()
    items.forEach((o) => {
      if (!isMapCoordinate(o.coords) || !KINDS[o.kind]) return
      const marker = L.marker(o.coords, { title: o.title, alt: o.title, keyboard: true, icon: markerIcon(o, variant, o.id === selected), zIndexOffset: o.id === selected ? 1000 : 0 })
        .on('click', () => onSelect?.(o))
        .addTo(group)
      marker.getElement()?.setAttribute('aria-label', `${t(KINDS[o.kind].label)}: ${o.title}`)
    })
    if (label) {
      const content = document.createElement('div')
      content.className = 'mlabel'
      content.append(document.createElement('i'), document.createTextNode(t(label)))
      L.marker(viewCenter, { icon: L.divIcon({ html: content, className: '', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(group)
    }
  }, [items, variant, selected, onSelect, label, viewCenter[0], viewCenter[1], language, mapRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  // позиция всплывающей карточки рядом с выбранным пином
  useEffect(() => {
    const m = map.current
    if (!m || !sel || !popup) return setPt(null)
    const update = () => {
      if (!el.current || !hasMapViewport(el.current.clientWidth, el.current.clientHeight)) return
      const point = m.latLngToContainerPoint(sel.coords)
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) setPt({ x: point.x, y: point.y })
    }
    update()
    m.on('move zoom resize', update)
    return () => {
      m.off('move zoom resize', update)
    }
  }, [sel?.id, sel?.coords[0], sel?.coords[1], Boolean(popup), mapRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Polling replaces item objects; move only when selection/coordinates change.
    if (sel && map.current && el.current && hasMapViewport(el.current.clientWidth, el.current.clientHeight) && (sel.coords[0] !== viewCenter[0] || sel.coords[1] !== viewCenter[1]) && !map.current.getBounds().pad(-0.15).contains(sel.coords)) map.current.panTo(sel.coords, { animate: false })
  }, [sel?.id, sel?.coords[0], sel?.coords[1], mapRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!popupEl.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setPt((point) => point && { ...point }))
    observer.observe(popupEl.current)
    return () => observer.disconnect()
  }, [Boolean(pt), sel?.id])

  const width = el.current?.clientWidth ?? 0
  const height = el.current?.clientHeight ?? 0
  const popupWidth = Math.min(300, Math.max(0, width - 24))
  const popupHeight = popupEl.current?.offsetHeight ?? 240

  const zoomBtns = (
    <div className="mctl-group">
      <button type="button" onClick={() => map.current?.zoomIn()} aria-label={t('Приблизить')}><Plus size={18} /></button>
      <button type="button" onClick={() => map.current?.zoomOut()} aria-label={t('Отдалить')}><Minus size={18} /></button>
    </div>
  )

  return (
    <div className={`smap ${theme}`}>
      <div ref={el} className="smap-canvas" />
      {controls === 'full' ? (
        <>
          <button type="button" className="mctl theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t(theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему')} title={t('Тема карты и сайта')}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="mctl-col">
            {zoomBtns}
            <button type="button" className="mctl" onClick={resetView} aria-label={t('К центру города')}><LocateFixed size={18} /></button>
          </div>
        </>
      ) : (
        <div className="mctl-left">{zoomBtns}</div>
      )}
      {sel && popup && pt && (
        <div
          ref={popupEl}
          className="mpop"
          style={{
            left: Math.max(12, Math.min(pt.x + 40, width - popupWidth - 12)),
            top: Math.max(12, Math.min(pt.y - 110, height - popupHeight - 12)),
            width: popupWidth,
            maxHeight: Math.max(0, height - 24),
            overflowY: 'auto',
          }}
          role="region"
          aria-label={t('Публикация: {title}', { title: sel.title })}
        >
          {popup(sel)}
        </div>
      )}
    </div>
  )
}
