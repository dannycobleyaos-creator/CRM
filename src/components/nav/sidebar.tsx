'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

import { HyggeWordmark } from '@/components/brand/logo';
import { NAV_SECTIONS, type NavCounts } from './nav-config';
import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function NavList({
  counts,
  canSeeManagement,
  onNavigate,
}: {
  counts: NavCounts;
  canSeeManagement: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) => !i.managementOnly || canSeeManagement);
        if (!items.length) return null;

        return (
          <div key={section.title}>
            <p className="px-3 pb-2 text-2xs font-semibold uppercase tracking-brand text-mist/45">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const count = item.countKey ? counts[item.countKey] ?? 0 : 0;
                const Icon = item.icon;

                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.description}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-brand px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-white/10 font-medium text-white'
                          : 'text-mist/75 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0 transition-colors',
                          active ? 'text-ember' : 'text-mist/50 group-hover:text-mist',
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
                            active ? 'bg-ember text-white' : 'bg-white/10 text-mist',
                          )}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  counts,
  canSeeManagement,
  footer,
}: {
  counts: NavCounts;
  canSeeManagement: boolean;
  footer: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-stone bg-white px-4 py-3 lg:hidden print:hidden">
        <HyggeWordmark compact />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-brand border border-stone p-2 text-slate hover:bg-sand"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'brand-canvas fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 print:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link href="/" onClick={() => setOpen(false)}>
            <HyggeWordmark variant="light" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="rounded-brand p-1.5 text-mist hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <NavList
          counts={counts}
          canSeeManagement={canSeeManagement}
          onNavigate={() => setOpen(false)}
        />

        <div className="border-t border-white/10 p-3">{footer}</div>
      </aside>
    </>
  );
}
