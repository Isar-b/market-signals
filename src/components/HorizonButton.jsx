export default function HorizonButton({ label, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[11px] md:text-xs font-medium transition-colors
        ${isSelected
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
        }`}
    >
      {label}
    </button>
  )
}
