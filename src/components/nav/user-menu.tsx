'use client';

import { useState } from 'react';
import { LogOut, ChevronUp } from 'lucide-react';

import { logout } from '@/actions/auth';
import { Avatar } from '@/components/ui/avatar';
import { ROLE_META, type Role } from '@/lib/constants';

export function UserMenu({
  name,
  role,
  team,
  avatarTone,
}: {
  name: string;
  role: Role;
  team: string;
  avatarTone: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-brand border border-white/10 bg-charcoal p-1 shadow-lift">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[0.4rem] px-3 py-2 text-sm text-mist transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-brand px-2 py-2 text-left transition-colors hover:bg-white/10"
      >
        <Avatar name={name} tone={avatarTone} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{name}</span>
          <span className="block truncate text-2xs text-mist/60">
            {ROLE_META[role]?.label ?? role} · {team}
          </span>
        </span>
        <ChevronUp
          className={`h-4 w-4 shrink-0 text-mist/50 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}
