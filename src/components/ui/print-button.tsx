'use client';

import { Printer } from 'lucide-react';

import { buttonClasses } from './button';

/** Prints the page — the portal chrome is hidden in print, leaving the document. */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClasses('secondary', 'sm', 'print:hidden')}
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
