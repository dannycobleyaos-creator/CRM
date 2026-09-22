'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';

/**
 * One box for customers, cases, orders and dispatch references. The whole point
 * of the portal is that an agent never has to guess which system a record is in.
 */
export function GlobalSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
      className="relative w-full max-w-md"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search customers, cases, orders, dispatches…"
        aria-label="Search the portal"
        className="field h-10 pl-9"
      />
    </form>
  );
}
