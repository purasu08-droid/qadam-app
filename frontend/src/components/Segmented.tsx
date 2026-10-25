type Props<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export default function Segmented<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
