export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="skeleton h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="skeleton aspect-square !rounded-none" />
            <div className="space-y-2 p-4">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
