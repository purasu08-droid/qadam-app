import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useI18n } from '../i18n'

type Coords = [number, number]

export default function LocationPicker({ center, value, onChange }: { center: Coords; value?: Coords; onChange: (value?: Coords) => void }) {
  const { t, language } = useI18n()
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)
  const change = useRef(onChange)
  change.current = onChange
  const [lat, setLat] = useState(value ? String(value[0]) : '')
  const [lng, setLng] = useState(value ? String(value[1]) : '')
  useEffect(() => {
    if (!host.current) return
    const instance = L.map(host.current).setView(value ?? center, 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(instance)
    instance.on('click', (event: L.LeafletMouseEvent) => {
      const coords: Coords = [Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))]
      setLat(String(coords[0])); setLng(String(coords[1])); change.current(coords)
    })
    const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }))
    resize.observe(host.current)
    map.current = instance
    return () => { resize.disconnect(); instance.remove(); map.current = null; marker.current = null }
  }, []) // the parent keys this component by city
  useEffect(() => {
    const container = map.current?.getContainer()
    for (const [selector, label] of [['.leaflet-control-zoom-in', t('Приблизить')], ['.leaflet-control-zoom-out', t('Отдалить')]]) {
      const button = container?.querySelector<HTMLElement>(selector)
      if (button) { button.title = label; button.setAttribute('aria-label', label) }
    }
  }, [language])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (marker.current) { marker.current.remove(); marker.current = null }
    if (value) marker.current = L.circleMarker(value, { radius: 10, color: '#d6f74a', fillColor: '#6c3df0', fillOpacity: .9, weight: 3 }).addTo(instance)
  }, [value?.[0], value?.[1]])
  const edit = (nextLat: string, nextLng: string) => {
    setLat(nextLat); setLng(nextLng)
    const a = Number(nextLat), b = Number(nextLng)
    change.current(nextLat.trim() && nextLng.trim() && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : undefined)
  }
  return <div className="location-picker">
    <p className="small">{t('Укажи точку на карте или введи координаты. Центр города не выбирается автоматически.')}</p>
    <div ref={host} className="location-picker-map" aria-label={t('Карта выбора места события')} />
    <div className="two">
      <label className="fld"><span>{t('Широта')}</span><input type="number" inputMode="decimal" step="any" min={-90} max={90} value={lat} onChange={(e) => edit(e.target.value, lng)} placeholder="43.2385" /></label>
      <label className="fld"><span>{t('Долгота')}</span><input type="number" inputMode="decimal" step="any" min={-180} max={180} value={lng} onChange={(e) => edit(lat, e.target.value)} placeholder="76.9300" /></label>
    </div>
    <p className="note" role="status">{t(value ? 'Точка выбрана' : 'Точка пока не выбрана')}</p>
  </div>
}
