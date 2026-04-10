export default function AssetButton({ label, isSelected, onClick, onRemove, canRemove }) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors pr-8
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
            opacity-0 group-hover:opacity-100 transition-opacity text-xs
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
