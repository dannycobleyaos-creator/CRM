import type { Metadata } from 'next';
import { CalendarCheck, Megaphone, PackageCheck, Phone } from 'lucide-react';

import { HyggeWordmark } from '@/components/brand/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

const HIGHLIGHTS = [
  { icon: Phone, title: 'Every conversation, one record', body: 'Calls, live chats and emails land on the customer — not in somebody’s inbox.' },
  { icon: CalendarCheck, title: 'Your day, already sorted', body: 'Log in and your work is listed in the order it needs doing.' },
  { icon: PackageCheck, title: 'Parts you can actually track', body: 'From request to courier to doorstep, with a tracking number attached.' },
  { icon: Megaphone, title: 'One place for announcements', body: 'Process changes land here, not halfway down a Slack channel.' },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="brand-canvas relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="louvre-texture absolute inset-0" aria-hidden />
        <div className="relative">
          <HyggeWordmark variant="light" />
        </div>

        <div className="relative max-w-lg">
          <p className="brand-eyebrow text-ember">The one stop shop</p>
          <h1 className="mt-4 font-display text-4xl font-light leading-tight text-white">
            Everything your customers need from you, in one portal.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-mist/85">
            No more hopping between Trello, Slack, Aircall and tawk to piece together
            what happened. Sign in and it is all here — what needs doing, who owns it,
            and what has already been actioned.
          </p>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-ember">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-mist/70">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-2xs uppercase tracking-brand text-mist/50">
          Hygge Pergola · Internal systems
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-linen px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden">
            <HyggeWordmark />
          </div>

          <p className="brand-eyebrow">Agent portal</p>
          <h2 className="mt-2 font-display text-2xl font-medium text-ink">Sign in</h2>
          <p className="mt-2 text-sm text-slate">
            Use the work email address your account was set up with.
          </p>

          <div className="mt-7">
            <LoginForm next={next} />
          </div>

          <div className="mt-8 rounded-brand border border-stone bg-sand/50 p-4">
            <p className="brand-eyebrow mb-2">Demo accounts</p>
            <dl className="space-y-1.5 text-xs text-slate">
              <div className="flex justify-between gap-3">
                <dt>Manager</dt>
                <dd className="font-medium text-ink">ruth.alderton@hyggepergola.co.uk</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Agent</dt>
                <dd className="font-medium text-ink">priya.raval@hyggepergola.co.uk</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Warehouse</dt>
                <dd className="font-medium text-ink">karolina.nowak@hyggepergola.co.uk</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-stone pt-1.5">
                <dt>Password</dt>
                <dd className="font-medium text-ink">hygge2024</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
