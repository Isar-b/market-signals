function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NewsCard({ article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-bg-card rounded-lg border border-border px-4 py-3 hover:border-accent/50 transition-colors"
    >
      <h3 className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
        {article.title}
      </h3>
      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-secondary">
        <span className="truncate">{article.source}</span>
        <span>&middot;</span>
        <span className="whitespace-nowrap">{timeAgo(article.publishedAt)}</span>
      </div>
    </a>
  )
}
