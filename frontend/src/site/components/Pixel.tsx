// Пиксель-арт пин QADAM: каждая «X» — один пиксель.
const PIN = [
  '....XXXX....',
  '..XXXXXXXX..',
  '.XXXXXXXXXX.',
  '.XXX....XXX.',
  'XXX......XXX',
  'XXX.o..o.XXX',
  'XXX......XXX',
  '.XXX.--.XXX.',
  '.XXXXXXXXXX.',
  '..XXXXXXXX..',
  '..XXXXXXXX..',
  '...XXXXXX...',
  '....XXXX....',
  '....XXXX....',
  '.....XX.....',
  '.....XX.....',
]

export function PixelPin({ size = 64, color = 'currentColor', face = false }: { size?: number; color?: string; face?: boolean }) {
  const rects: JSX.Element[] = []
  PIN.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === 'X') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color} />)
      if (face && (c === 'o' || c === '-'))
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color} className={c === 'o' ? 'px-eye' : ''} />)
    }),
  )
  return (
    <svg width={size * 0.75} height={size} viewBox="0 0 12 16" shapeRendering="crispEdges" aria-hidden>
      {rects}
    </svg>
  )
}

export function SiteLogo({ size = 24 }: { size?: number }) {
  return (
    <span className="site-logo">
      <PixelPin size={size} color="var(--lime)" />
      <span>QADAM</span>
    </span>
  )
}
