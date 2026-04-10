export default function AssetButton({ label, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${isSelected
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
        }`}
    >
      {label}
    </button>
  )
}
