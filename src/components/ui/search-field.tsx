import { Search } from 'lucide-react';

/**
 * A plain GET form — no client JS, and the resulting URL is shareable.
 * Hidden inputs carry the active filters so searching never resets the view.
 */
export function SearchField({
  action,
  defaultValue,
  placeholder = 'Search…',
  hidden = {},
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} method="get" role="search" className="relative w-full sm:w-72">
      {Object.entries(hidden).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field h-9 pl-9 text-xs"
      />
    </form>
  );
}
