/** Skeleton canônico de loading (`animate-pulse bg-rose-100 rounded-xl`). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-rose-100 rounded-xl ${className}`} />
}

/** 5 linhas de skeleton para primeira carga de tabelas. */
export function TableSkeleton() {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-rose-200 p-6 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

/** 3 cards de skeleton para primeira carga de grids. */
export function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </div>
  )
}
