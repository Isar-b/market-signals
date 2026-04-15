export default function AssetButton({ label, source, isSelected, onClick, onRemove, canRemove, onMoveUp, onMoveDown }) {
  const isHL = source === 'hyperliquid'
  return (
    <div className="relative group flex items-center">
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
          ${isSelected
            ? isHL ? 'bg-hl-accent text-white' : 'bg-accent text-white'
            : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
          }`}
      >
        <div className="flex items-center justify-between">
          <span className="truncate pr-2 flex items-center gap-1.5">
            {label}
            {isHL && (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded leading-none ${isSelected ? 'bg-white/20' : 'bg-hl-accent/20 text-hl-accent'}`}>
                HL
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
              disabled={!onMoveUp}
              className={`w-7 h-7 md:w-5 md:h-5 flex items-center justify-center rounded text-xs
                ${!onMoveUp ? 'invisible' : isSelected ? 'text-white/60 active:bg-white/20 md:hover:text-white' : 'text-text-secondary active:bg-bg-primary md:hover:text-text-primary'}`}
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
              disabled={!onMoveDown}
              className={`w-7 h-7 md:w-5 md:h-5 flex items-center justify-center rounded text-xs
                ${!onMoveDown ? 'invisible' : isSelected ? 'text-white/60 active:bg-white/20 md:hover:text-white' : 'text-text-secondary active:bg-bg-primary md:hover:text-text-primary'}`}
              title="Move down"
            >
              ▼
            </button>
            {onRemove && canRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove() }}
                className={`w-7 h-7 md:w-5 md:h-5 flex items-center justify-center rounded text-xs
                  ${isSelected
                    ? 'text-white/60 active:bg-white/20 md:hover:text-white'
                    : 'text-text-secondary active:bg-bg-primary md:hover:text-red'
                  }`}
                title="Remove asset"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}
