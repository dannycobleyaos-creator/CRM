import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { Boxes, CircleOff, PackagePlus, PoundSterling, TriangleAlert, Truck } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  PART_CATEGORIES,
  PART_CATEGORY_META,
  PURCHASE_OPEN_STATUSES,
  byCatalogueOrder,
} from '@/lib/constants';
import { formatMoney, formatPrice, percent } from '@/lib/utils';
import { raiseReorders } from '@/actions/purchasing';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { ButtonLink } from '@/components/ui/button';
import { ActionForm } from '@/components/ui/action-form';
import { PartCategoryChip, StockBadge } from '@/components/status-chips';
import { InventoryNav } from '@/components/inventory/inventory-nav';

export const metadata: Metadata = { title: 'Inventory' };
export const dynamic = 'force-dynamic';

type Search = { category?: string; stock?: string; q?: string };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { category = '', stock = '', q } = await searchParams;
  const manage = canManageStock(user);

  const where: Prisma.PartWhereInput = { isActive: stock === 'retired' ? false : true };
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { sku: { contains: q } },
      { name: { contains: q } },
      { supplier: { contains: q } },
      { location: { contains: q } },
    ];
  }

  const [all, onOrderLines, openPurchases, bomUse] = await Promise.all([
    db.part.findMany({ where }),
    db.purchaseOrderLine.findMany({
      where: { purchaseOrder: { status: { in: [...PURCHASE_OPEN_STATUSES] } } },
      select: { partId: true, qty: true, purchaseOrder: { select: { status: true } } },
    }),
    db.purchaseOrder.count({ where: { status: { in: [...PURCHASE_OPEN_STATUSES] } } }),
    db.bomLine.groupBy({ by: ['partId'], _count: { _all: true } }),
  ]);

  // Sent to the supplier is "on order"; a draft nobody has sent yet is not —
  // but it does mean the reorder is in hand, so it is shown separately.
  const onOrder = new Map<string, number>();
  const drafted = new Map<string, number>();
  for (const l of onOrderLines) {
    const map = l.purchaseOrder.status === 'SENT' ? onOrder : drafted;
    map.set(l.partId, (map.get(l.partId) ?? 0) + l.qty);
  }
  const usedIn = new Map(bomUse.map((row) => [row.partId, row._count._all]));

  const sorted = [...all].sort(byCatalogueOrder);
  const parts =
    stock === 'low'
      ? sorted.filter((p) => p.stockQty <= p.reorderLevel)
      : stock === 'out'
        ? sorted.filter((p) => p.stockQty <= 0)
        : sorted;

  // Headline numbers always describe the whole active catalogue, not the filter.
  const catalogue = category || q || stock ? await db.part.findMany({ where: { isActive: true } }) : all;
  const stockValue = catalogue.reduce((s, p) => s + p.stockQty * p.unitCost, 0);
  const lowStock = catalogue.filter((p) => p.stockQty <= p.reorderLevel);
  const outOfStock = catalogue.filter((p) => p.stockQty <= 0).length;
  const unitsOnOrder = [...onOrder.values()].reduce((s, n) => s + n, 0);
  const lowNotOnOrder = lowStock.filter((p) => !onOrder.has(p.id) && !drafted.has(p.id));

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="Inventory"
        description="Every spare part we hold: what it costs us, what we charge, where it lives and how many are on the shelf right now."
        actions={
          <>
            <SearchField
              action="/inventory"
              defaultValue={q}
              hidden={{ category, stock }}
              placeholder="SKU, part, supplier, bay…"
            />
            {manage && (
              <ButtonLink href="/inventory/new" size="sm">
                <PackagePlus className="h-4 w-4" />
                Add part
              </ButtonLink>
            )}
          </>
        }
      />

      <InventoryNav active="parts" lowStock={lowStock.length} openPurchases={openPurchases} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Stock value"
          value={formatMoney(stockValue)}
          sub={`${catalogue.length} parts, valued at cost`}
          tone="ember"
          icon={<PoundSterling className="h-4 w-4" />}
        />
        <Stat
          label="At or below reorder"
          value={lowStock.length}
          sub={
            lowNotOnOrder.length
              ? `${lowNotOnOrder.length} not yet on a purchase order`
              : 'All covered by open purchase orders'
          }
          tone={lowNotOnOrder.length ? 'amber' : 'moss'}
          icon={<TriangleAlert className="h-4 w-4" />}
          href="/inventory?stock=low"
        />
        <Stat
          label="Out of stock"
          value={outOfStock}
          sub="Cannot be picked today"
          tone={outOfStock ? 'clay' : 'moss'}
          icon={<CircleOff className="h-4 w-4" />}
          href="/inventory?stock=out"
        />
        <Stat
          label="On order"
          value={unitsOnOrder}
          sub={`Units with suppliers${drafted.size ? `, plus ${drafted.size} ${drafted.size === 1 ? 'part' : 'parts'} on a draft` : ''}`}
          tone="sky"
          icon={<Truck className="h-4 w-4" />}
          href="/inventory/purchasing?view=open"
        />
      </div>

      {manage && lowNotOnOrder.length > 0 && (
        <Card className="border-amber/40">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="brand-eyebrow">Needs reordering</p>
              <p className="mt-1 text-sm text-ink">
                {lowNotOnOrder.map((p) => p.name).slice(0, 4).join(', ')}
                {lowNotOnOrder.length > 4 ? ` and ${lowNotOnOrder.length - 4} more` : ''}
              </p>
              <p className="mt-0.5 text-2xs text-slate">
                One click raises a draft purchase order per supplier at each part&apos;s reorder quantity.
                Nothing is sent until you check it.
              </p>
            </div>
            <ActionForm action={raiseReorders}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-brand bg-charcoal px-4 text-xs font-medium text-white transition-colors hover:bg-ink"
              >
                <Truck className="h-4 w-4" />
                Draft purchase orders
              </button>
            </ActionForm>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          basePath="/inventory"
          paramKey="category"
          active={category}
          params={{ stock, q }}
          options={[
            { value: '', label: 'All parts' },
            ...PART_CATEGORIES.map((c) => ({ value: c, label: PART_CATEGORY_META[c].label })),
          ]}
        />
        <span className="hidden h-5 w-px bg-stone sm:block" />
        <FilterTabs
          basePath="/inventory"
          paramKey="stock"
          active={stock}
          params={{ category, q }}
          options={[
            { value: '', label: 'Any stock' },
            { value: 'low', label: 'Reorder now' },
            { value: 'out', label: 'Out of stock' },
            { value: 'retired', label: 'Retired' },
          ]}
        />
      </div>

      <Card>
        <CardHeader
          eyebrow={`${parts.length} ${parts.length === 1 ? 'part' : 'parts'}`}
          title="Parts catalogue"
          description="Prices are ex VAT. Selling price is what a customer pays for a spare; cost is what we pay the supplier."
        />
        {parts.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th className="hidden md:table-cell">Category</th>
                  <th>Stock</th>
                  <th className="hidden lg:table-cell">On order</th>
                  <th className="hidden sm:table-cell text-right">Cost</th>
                  <th className="text-right">Price</th>
                  <th className="hidden xl:table-cell text-right">Margin</th>
                  <th className="hidden xl:table-cell">Used in</th>
                  <th className="hidden lg:table-cell">Bay</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const margin = p.unitPrice > 0 ? percent(p.unitPrice - p.unitCost, p.unitPrice) : null;
                  const ordered = onOrder.get(p.id) ?? 0;
                  const draft = drafted.get(p.id) ?? 0;
                  const uses = usedIn.get(p.id) ?? 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/inventory/${p.id}`} className="group block min-w-[14rem]">
                          <span className="block text-sm font-medium text-ink group-hover:text-ember-dark">
                            {p.name}
                          </span>
                          <span className="mt-0.5 block text-2xs text-slate">
                            <span className="font-mono">{p.sku}</span>
                            {p.supplier ? ` · ${p.supplier}` : ''}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden md:table-cell">
                        <PartCategoryChip value={p.category} dot={false} />
                      </td>
                      <td>
                        <StockBadge qty={p.stockQty} reorderLevel={p.reorderLevel} />
                      </td>
                      <td className="hidden lg:table-cell text-xs tabular-nums text-slate">
                        {ordered ? <span className="font-medium text-sky">+{ordered}</span> : null}
                        {draft ? (
                          <span className="block text-2xs text-slate" title="On a purchase order that has not been sent yet">
                            +{draft} draft
                          </span>
                        ) : null}
                        {!ordered && !draft ? '—' : null}
                      </td>
                      <td className="hidden sm:table-cell text-right text-xs tabular-nums text-slate">
                        {formatPrice(p.unitCost)}
                      </td>
                      <td className="text-right text-sm font-medium tabular-nums text-ink">
                        {formatPrice(p.unitPrice)}
                      </td>
                      <td className="hidden xl:table-cell text-right text-xs tabular-nums text-slate">
                        {margin === null ? '—' : `${margin}%`}
                      </td>
                      <td className="hidden xl:table-cell text-xs text-slate">
                        {uses ? `${uses} ${uses === 1 ? 'product' : 'products'}` : '—'}
                      </td>
                      <td className="hidden lg:table-cell font-mono text-2xs text-slate">
                        {p.location ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="No parts match"
            description="Try a different category or clear the search."
          />
        )}
      </Card>
    </>
  );
}
