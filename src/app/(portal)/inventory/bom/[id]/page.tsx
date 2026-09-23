import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { VAT_RATE, byCatalogueOrder } from '@/lib/constants';
import { formatMoney, formatPrice, percent } from '@/lib/utils';
import { updateBomLine } from '@/actions/inventory';

import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { ActionForm } from '@/components/ui/action-form';
import { OrderStatusChip, PartCategoryChip, StockBadge } from '@/components/status-chips';
import { BomLineForm } from '@/components/inventory/bom-line-form';
import { ProductForm } from '@/components/inventory/product-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id }, select: { name: true } });
  return { title: product ? `${product.name} — bill of materials` : 'Bill of materials' };
}

export default async function BomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const manage = canManageStock(user);
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: {
      bom: { include: { part: true } },
      orders: {
        orderBy: { orderedAt: 'desc' },
        take: 8,
        include: { customer: { select: { name: true } } },
      },
      _count: { select: { orders: true } },
    },
  });
  if (!product) notFound();

  const parts = manage
    ? await db.part.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: { id: true, sku: true, name: true },
      })
    : [];

  product.bom.sort((a, b) => byCatalogueOrder(a.part, b.part));
  const cost = product.bom.reduce((s, l) => s + l.qty * l.part.unitCost, 0);
  const spares = product.bom.reduce((s, l) => s + l.qty * l.part.unitPrice, 0);
  const exVat = product.basePrice / (1 + VAT_RATE);
  const margin = exVat > 0 && product.bom.length ? percent(exVat - cost, exVat) : null;
  const pieces = product.bom.reduce((s, l) => s + l.qty, 0);

  return (
    <>
      <Link href="/inventory/bom" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to bills of materials
      </Link>

      <PageHeader eyebrow={product.code} title={product.name} description={product.sizeSpec ?? undefined} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Parts cost" value={formatPrice(cost)} sub={`${product.bom.length} lines, ${pieces} pieces at supplier cost`} tone="ember" />
        <Stat
          label="Selling price"
          value={formatMoney(product.basePrice)}
          sub={`${formatPrice(exVat)} ex VAT`}
          tone="slate"
        />
        <Stat
          label="Margin on parts"
          value={margin === null ? '—' : `${margin}%`}
          sub="Before labour, delivery and installation"
          tone={margin === null ? 'slate' : margin >= 40 ? 'moss' : 'amber'}
        />
        <Stat label="Sold" value={product._count.orders} sub="Orders on this product" tone="sky" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow="Bill of materials"
            title="What goes into one"
            description={
              manage
                ? 'Change a quantity and press enter. Set it to zero, or use the bin, to take a part off the bill.'
                : 'The parts in one of these pergolas, with what each costs us and sells for as a spare.'
            }
          />
          {product.bom.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th className="w-28">Qty</th>
                    <th className="hidden md:table-cell text-right">Unit cost</th>
                    <th className="text-right">Line cost</th>
                    <th className="hidden lg:table-cell text-right">Spare price</th>
                    <th className="hidden sm:table-cell">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {product.bom.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/inventory/${l.part.id}`} className="group block min-w-[13rem]">
                          <span className="block text-sm font-medium text-ink group-hover:text-ember-dark">{l.part.name}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-2xs text-slate">
                            <span className="font-mono">{l.part.sku}</span>
                            <PartCategoryChip value={l.part.category} dot={false} />
                          </span>
                        </Link>
                      </td>
                      <td>
                        {manage ? (
                          <div className="flex items-center gap-1">
                            <ActionForm action={updateBomLine} fields={{ lineId: l.id }}>
                              <input
                                name="qty"
                                type="number"
                                min={0}
                                defaultValue={l.qty}
                                aria-label={`Quantity of ${l.part.name}`}
                                className="field h-8 w-16 px-2 text-xs tabular-nums"
                              />
                            </ActionForm>
                            <ActionForm action={updateBomLine} fields={{ lineId: l.id, qty: '0' }}>
                              <button
                                type="submit"
                                title={`Take ${l.part.name} off the bill`}
                                aria-label={`Remove ${l.part.name}`}
                                className="rounded-brand p-1.5 text-slate/70 transition-colors hover:bg-clay-soft hover:text-clay"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </ActionForm>
                          </div>
                        ) : (
                          <span className="text-sm tabular-nums text-ink">{l.qty}</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell text-right text-xs tabular-nums text-slate">{formatPrice(l.part.unitCost)}</td>
                      <td className="text-right text-sm tabular-nums text-ink">{formatPrice(l.qty * l.part.unitCost)}</td>
                      <td className="hidden lg:table-cell text-right text-xs tabular-nums text-slate">{formatPrice(l.part.unitPrice)}</td>
                      <td className="hidden sm:table-cell">
                        <StockBadge qty={l.part.stockQty} reorderLevel={l.part.reorderLevel} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-4 py-3 text-2xs font-semibold uppercase tracking-brand text-slate">Total</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate">{pieces} pcs</td>
                    <td className="hidden md:table-cell" />
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-ink">{formatPrice(cost)}</td>
                    <td className="hidden lg:table-cell px-4 py-3 text-right text-xs tabular-nums text-slate">{formatPrice(spares)}</td>
                    <td className="hidden sm:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <EmptyState title="No parts on this bill yet" description={manage ? 'Add the first part below.' : 'Nobody has listed the parts yet.'} />
          )}
          {manage && (
            <CardBody className="border-t border-stone/70 bg-sand/30">
              <BomLineForm productId={product.id} parts={parts} />
            </CardBody>
          )}
        </Card>

        <div className="space-y-6">
          {manage && (
            <Card>
              <CardHeader eyebrow="Product" title="Details" />
              <CardBody>
                <ProductForm
                  product={{
                    id: product.id,
                    code: product.code,
                    name: product.name,
                    sizeSpec: product.sizeSpec,
                    description: product.description,
                    basePrice: product.basePrice,
                  }}
                />
              </CardBody>
            </Card>
          )}
          {!manage && product.description && (
            <Card>
              <CardBody className="text-sm text-slate">{product.description}</CardBody>
            </Card>
          )}

          <Card>
            <CardHeader eyebrow={`${product._count.orders} total`} title="Recent orders" />
            {product.orders.length ? (
              <ul className="divide-y divide-stone/60">
                {product.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sand/40">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-ink">{o.customer.name}</span>
                        <span className="font-mono text-2xs text-slate">{o.ref}</span>
                      </span>
                      <OrderStatusChip value={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Not sold yet" description="Orders for this product will appear here." />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
