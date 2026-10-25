export function Pin({ size = 64, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size * 0.75} height={size} viewBox="0 0 24 32" aria-hidden>
      <path
        fill={color}
        d="M12 0C5.4 0 0 5.3 0 11.8 0 20.6 12 32 12 32s12-11.4 12-20.2C24 5.3 18.6 0 12 0zm0 17a5.4 5.4 0 1 1 0-10.8A5.4 5.4 0 0 1 12 17z"
      />
    </svg>
  )
}

export default function Logo({ size = 64, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <div className="logo">
      <Pin size={size} />
      {wordmark && <span className="wordmark" style={{ fontSize: size * 0.48 }}>QADAM</span>}
    </div>
  )
}
