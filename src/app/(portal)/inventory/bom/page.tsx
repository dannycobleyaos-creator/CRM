import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers, Plus } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PURCHASE_OPEN_STATUSES, VAT_RATE } from '@/lib/constants';
import { formatMoney, formatPrice, percent } from '@/lib/utils';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryNav } from '@/components/inventory/inventory-nav';

export const metadata: Metadata = { title: 'Bills of materials' };
export const dynamic = 'force-dynamic';

export default async function BomListPage() {
  const user = await requireUser();
  const manage = canManageStock(user);

  const [products, lowStock, openPurchases] = await Promise.all([
    db.product.findMany({
      orderBy: { basePrice: 'asc' },
      include: {
        bom: { include: { part: { select: { unitCost: true, unitPrice: true, stockQty: true } } } },
        _count: { select: { orders: true } },
      },
    }),
    db.part.findMany({ where: { isActive: true }, select: { stockQty: true, reorderLevel: true } }),
    db.purchaseOrder.count({ where: { status: { in: [...PURCHASE_OPEN_STATUSES] } } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="Bills of materials"
        description="What goes into every pergola we sell. Agents order replacement parts straight from these lists, and the cost roll-up shows what each one takes to build."
        actions={
          manage ? (
            <ButtonLink href="/inventory/bom/new" size="sm">
              <Plus className="h-4 w-4" />
              New product
            </ButtonLink>
          ) : undefined
        }
      />

      <InventoryNav
        active="bom"
        lowStock={lowStock.filter((p) => p.stockQty <= p.reorderLevel).length}
        openPurchases={openPurchases}
      />

      <Card>
        <CardHeader
          eyebrow={`${products.length} products`}
          title="Products"
          description="Parts cost is at supplier cost price. Margin compares it with the selling price ex VAT."
        />
        {products.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="hidden md:table-cell">Parts</th>
                  <th className="text-right">Parts cost</th>
                  <th className="hidden lg:table-cell text-right">Spares value</th>
                  <th className="text-right">Selling price</th>
                  <th className="hidden sm:table-cell text-right">Margin</th>
                  <th className="hidden lg:table-cell">Orders</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const cost = p.bom.reduce((s, l) => s + l.qty * l.part.unitCost, 0);
                  const spares = p.bom.reduce((s, l) => s + l.qty * l.part.unitPrice, 0);
                  const exVat = p.basePrice / (1 + VAT_RATE);
                  const margin = exVat > 0 ? percent(exVat - cost, exVat) : null;
                  const pieces = p.bom.reduce((s, l) => s + l.qty, 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/inventory/bom/${p.id}`} className="group block min-w-[14rem]">
                          <span className="block text-sm font-medium text-ink group-hover:text-ember-dark">
                            {p.name}
                          </span>
                          <span className="mt-0.5 block text-2xs text-slate">
                            <span className="font-mono">{p.code}</span>
                            {p.sizeSpec ? ` · ${p.sizeSpec}` : ''}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden md:table-cell text-xs text-slate">
                        {p.bom.length ? (
                          `${p.bom.length} lines · ${pieces} pieces`
                        ) : (
                          <Badge tone="amber" dot>No bill yet</Badge>
                        )}
                      </td>
                      <td className="text-right text-sm tabular-nums text-ink">{formatPrice(cost)}</td>
                      <td className="hidden lg:table-cell text-right text-xs tabular-nums text-slate">
                        {formatPrice(spares)}
                      </td>
                      <td className="text-right text-sm font-medium tabular-nums text-ink">
                        {formatMoney(p.basePrice)}
                      </td>
                      <td className="hidden sm:table-cell text-right text-xs tabular-nums text-slate">
                        {margin === null || !p.bom.length ? '—' : `${margin}%`}
                      </td>
                      <td className="hidden lg:table-cell text-xs tabular-nums text-slate">{p._count.orders}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="No products yet"
            description="Add a product, then list the parts that go into it."
          />
        )}
      </Card>
    </>
  );
}
