export function isMapCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2
    && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90
    && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180
}

// Leaflet's animated projection divides by the viewport size; CSS-hidden maps have no viewport.
export function hasMapViewport(width: number, height: number) {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
}

export function mapZoom(value: number) {
  return Number.isFinite(value) ? Math.min(19, Math.max(0, value)) : 13
}
