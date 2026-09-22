/** Holds the shape of the page while data loads, so nothing jumps. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="space-y-3 border-b border-stone pb-5">
        <div className="h-2.5 w-24 rounded-full bg-sand" />
        <div className="h-7 w-56 rounded-brand bg-sand" />
        <div className="h-3 w-96 max-w-full rounded-full bg-sand/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-28 bg-sand/40" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card h-80 bg-sand/40" />
        <div className="card h-80 bg-sand/40" />
      </div>
    </div>
  );
}
