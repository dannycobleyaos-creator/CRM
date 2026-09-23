import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { ArrowLeft, MapPin, UserRound } from 'lucide-react';

import { isManagement, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { TICKET_ACTIVE_STATUSES } from '@/lib/constants';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SearchField } from '@/components/ui/search-field';
import { CustomerStageChip } from '@/components/status-chips';
import { PartsOrderForm } from '@/components/parts-orders/parts-order-form';

export const metadata: Metadata = { title: 'New parts order' };
export const dynamic = 'force-dynamic';

type Search = { customerId?: string; orderId?: string; ticketId?: string; q?: string };

export default async function NewPartsOrderPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { customerId, orderId, ticketId, q } = await searchParams;

  const customer = customerId
    ? await db.customer.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            where: { status: { not: 'CANCELLED' } },
            orderBy: { orderedAt: 'desc' },
            select: { id: true, ref: true, productLine: true, colour: true, productId: true },
          },
          tickets: {
            where: { status: { in: [...TICKET_ACTIVE_STATUSES] } },
            orderBy: { openedAt: 'desc' },
            select: { id: true, ref: true, subject: true },
          },
        },
      })
    : null;

  // Step one: who is it for? Most people arrive here from a customer, order or
  // case with the answer already in the link, so this is the fallback.
  if (!customer) {
    const where: Prisma.CustomerWhereInput = q
      ? {
          OR: [
            { name: { contains: q } },
            { ref: { contains: q } },
            { postcode: { contains: q } },
            { email: { contains: q } },
            { orders: { some: { ref: { contains: q } } } },
          ],
        }
      : {};
    const customers = await db.customer.findMany({
      where,
      orderBy: q ? { name: 'asc' } : { updatedAt: 'desc' },
      take: 12,
      select: { id: true, name: true, ref: true, stage: true, city: true, postcode: true },
    });

    return (
      <>
        <Link href="/parts-orders" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to parts orders
        </Link>
        <PageHeader
          eyebrow="Parts orders"
          title="Who are the parts for?"
          description="Find the customer. The parts ship to the address on their record, and their pergola's bill of materials is ready to pick from."
          actions={<SearchField action="/parts-orders/new" defaultValue={q} placeholder="Name, postcode, order number…" />}
        />
        <Card>
          <CardHeader eyebrow={q ? `${customers.length} found` : 'Recently updated'} title="Customers" />
          {customers.length ? (
            <ul className="divide-y divide-stone/60">
              {customers.map((c) => (
                <li key={c.id}>
                  <Link href={`/parts-orders/new?customerId=${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sand/40">
                    <span className="flex min-w-0 items-center gap-3">
                      <UserRound className="h-4 w-4 shrink-0 text-slate" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                        <span className="text-2xs text-slate">
                          <span className="font-mono">{c.ref}</span>
                          {c.city ? ` · ${c.city}` : ''}
                          {c.postcode ? ` · ${c.postcode}` : ''}
                        </span>
                      </span>
                    </span>
                    <CustomerStageChip value={c.stage} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={`Nobody matches “${q}”`} description="Try the surname, the postcode or the order number." />
          )}
        </Card>
      </>
    );
  }

  const productIds = [...new Set(customer.orders.map((o) => o.productId).filter((id): id is string => !!id))];
  const [parts, bomLines] = await Promise.all([
    db.part.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, name: true, category: true, unitPrice: true, stockQty: true },
    }),
    db.bomLine.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, partId: true, qty: true },
    }),
  ]);
  const boms: Record<string, { partId: string; qty: number }[]> = {};
  for (const l of bomLines) (boms[l.productId] ??= []).push({ partId: l.partId, qty: l.qty });

  const address = [customer.addressL1, customer.addressL2, customer.city, customer.postcode].filter(Boolean).join(', ');
  const validOrder = customer.orders.some((o) => o.id === orderId) ? orderId : undefined;
  const validTicket = customer.tickets.some((t) => t.id === ticketId) ? ticketId : undefined;

  return (
    <>
      <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {customer.name}
      </Link>
      <PageHeader
        eyebrow="New parts order"
        title={customer.name}
        description="Placing the order creates the order confirmation and the warehouse dispatch together."
        actions={
          <Link href="/parts-orders/new" className="text-xs text-slate underline-offset-4 hover:text-ink hover:underline">
            Different customer
          </Link>
        }
      />
      {address && (
        <p className="-mt-2 inline-flex items-center gap-2 text-xs text-slate">
          <MapPin className="h-3.5 w-3.5" />
          Ships to {address}
        </p>
      )}
      <PartsOrderForm
        customerId={customer.id}
        orders={customer.orders}
        tickets={customer.tickets}
        boms={boms}
        parts={parts}
        defaultOrderId={validOrder}
        defaultTicketId={validTicket}
        releasedOnPlacing={isManagement(user.role) || user.team === 'Warehouse'}
      />
    </>
  );
}
