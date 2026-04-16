import { useNews } from '../hooks/useNews'
import NewsCard from '../components/NewsCard'

export default function NewsPanel({ asset }) {
  const { articles, loading, error } = useNews(asset?.id, asset?.label)

  return (
    <>
      <div className="flex flex-col gap-2">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-full max-w-xs bg-bg-primary rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
            </div>
            <p className="text-sm text-text-secondary text-center animate-pulse">
              Fetching trending news...
            </p>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-full bg-bg-card rounded-lg border border-border px-4 py-3 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="h-3 bg-bg-primary rounded w-4/5 mb-2" />
                <div className="h-2 bg-bg-primary rounded w-1/3" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="text-red text-sm py-4">
            Failed to load news: {error}
          </div>
        )}
        {!loading && !error && articles.length === 0 && (
          <p className="text-text-secondary text-sm">No recent news found for this asset.</p>
        )}
        {!loading && articles.map((article, i) => (
          <NewsCard key={article.url || i} article={article} />
        ))}
      </div>
    </>
  )
}
