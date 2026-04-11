export default function AssetButton({ label, isSelected, onClick, onRemove, canRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="relative group flex items-center gap-0.5">
      <div className="flex flex-col md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
          disabled={!onMoveUp}
          className={`w-4 h-3.5 flex items-center justify-center rounded-sm text-[9px] leading-none
            ${!onMoveUp ? 'invisible' : isSelected ? 'text-white/50 hover:text-white' : 'text-text-secondary hover:text-text-primary'}`}
          title="Move up"
        >
          ▲
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
          disabled={!onMoveDown}
          className={`w-4 h-3.5 flex items-center justify-center rounded-sm text-[9px] leading-none
            ${!onMoveDown ? 'invisible' : isSelected ? 'text-white/50 hover:text-white' : 'text-text-secondary hover:text-text-primary'}`}
          title="Move down"
        >
          ▼
        </button>
      </div>
      <button
        onClick={onClick}
        className={`w-full text-left px-2 py-2.5 rounded-lg text-sm font-medium transition-colors pr-8
          ${isSelected
            ? 'bg-accent text-white'
            : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
          }`}
      >
        {label}
      </button>
      {onRemove && canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center
            md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs
            ${isSelected
              ? 'text-white/70 hover:text-white hover:bg-white/20'
              : 'text-text-secondary hover:text-red hover:bg-bg-card'
            }`}
          title="Remove asset"
        >
          ✕
        </button>
      )}
    </div>
  )
}
