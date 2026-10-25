import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { CATEGORIES, type Project } from '../data/mock'

const KZ_CENTER: [number, number] = [48.0, 67.5]
const KZ_BOUNDS: L.LatLngBoundsExpression = [
  [41.0, 50.0],
  [55.0, 80.0],
]
const DGIS_KEY = import.meta.env.VITE_DGIS_KEY as string | undefined
// Тёмный стиль 2GIS MapGL
const DGIS_DARK_STYLE = 'e05ac437-fcc2-4845-ad74-b1de9ce07555'

type Props = { projects: Project[]; onSelect: (p: Project) => void }

export default function MapView(props: Props) {
  return DGIS_KEY ? <DgisMap {...props} apiKey={DGIS_KEY} /> : <LeafletMap {...props} />
}

function markerHtml(p: Project) {
  const c = CATEGORIES[p.category]
  const fill = p.category === 'events' ? '#22a06b' : c.color === '#141418' ? '#3b5bf6' : c.color
  return `<div class="map-marker" style="--c:${fill}"><span></span></div>`
}

function LeafletMap({ projects, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).fitBounds(KZ_BOUNDS)
    // OSM-тайлы, затемнённые через CSS (.dark-tiles) — тёмный режим без API-ключа
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      className: 'dark-tiles',
    }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const group = layer.current
    if (!group) return
    group.clearLayers()
    projects.forEach((p) => {
      const icon = L.divIcon({ html: markerHtml(p), className: '', iconSize: [34, 34], iconAnchor: [17, 17] })
      L.marker(p.coords, { icon }).on('click', () => onSelect(p)).addTo(group)
    })
  }, [projects, onSelect])

  return <div ref={el} className="map-canvas" />
}

type MapGL = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => { destroy: () => void }
  HtmlMarker: new (
    map: unknown,
    opts: { coordinates: [number, number]; html: string },
  ) => { destroy: () => void; getContent: () => HTMLElement }
}

function loadMapGL(): Promise<MapGL> {
  const w = window as unknown as { mapgl?: MapGL }
  if (w.mapgl) return Promise.resolve(w.mapgl)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://mapgl.2gis.com/api/js/v1'
    s.onload = () => resolve(w.mapgl!)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function DgisMap({ projects, onSelect, apiKey }: Props & { apiKey: string }) {
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let destroyed = false
    let cleanup = () => {}
    loadMapGL().then((mapgl) => {
      if (destroyed || !el.current) return
      const map = new mapgl.Map(el.current, {
        key: apiKey,
        center: [KZ_CENTER[1], KZ_CENTER[0]],
        zoom: 4.6,
        style: DGIS_DARK_STYLE,
      })
      const markers = projects.map((p) => {
        const m = new mapgl.HtmlMarker(map, { coordinates: [p.coords[1], p.coords[0]], html: markerHtml(p) })
        m.getContent().addEventListener('click', () => onSelect(p))
        return m
      })
      cleanup = () => {
        markers.forEach((m) => m.destroy())
        map.destroy()
      }
    })
    return () => {
      destroyed = true
      cleanup()
    }
  }, [projects, onSelect, apiKey])

  return <div ref={el} className="map-canvas" />
}
