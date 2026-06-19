interface Props {
  className?: string
  rows?: number
  cols?: number
}

export function Skeleton({ className = 'h-4 w-full' }: Props) {
  return <div className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
}

export function SkeletonTable({ rows = 5, cols = 6 }: Props) {
  return (
    <div className="space-y-2 p-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 w-3/4" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className="h-4 w-full" />)}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
