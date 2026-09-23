import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PartForm } from '@/components/inventory/part-form';

export const metadata: Metadata = { title: 'Add a part' };
export const dynamic = 'force-dynamic';

export default async function NewPartPage() {
  const user = await requireUser();
  if (!canManageStock(user)) redirect('/inventory');

  const suppliers = await db.part.findMany({
    where: { supplier: { not: null } },
    distinct: ['supplier'],
    select: { supplier: true },
    orderBy: { supplier: 'asc' },
  });

  return (
    <>
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to inventory
      </Link>
      <PageHeader
        eyebrow="Inventory"
        title="Add a part"
        description="Once it is in the catalogue it can be ordered for customers, added to a bill of materials and bought in from the supplier."
      />
      <Card className="max-w-3xl">
        <CardHeader eyebrow="New part" title="Part details" />
        <CardBody>
          <PartForm suppliers={suppliers.map((s) => s.supplier!).filter(Boolean)} />
        </CardBody>
      </Card>
    </>
  );
}
