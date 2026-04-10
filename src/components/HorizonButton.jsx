export default function HorizonButton({ label, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
        ${isSelected
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
        }`}
    >
      {label}
    </button>
  )
}
