import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ProductForm } from '@/components/inventory/product-form';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  const user = await requireUser();
  if (!canManageStock(user)) redirect('/inventory/bom');

  return (
    <>
      <Link href="/inventory/bom" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to bills of materials
      </Link>
      <PageHeader
        eyebrow="Bills of materials"
        title="New product"
        description="Create the product first — you will add its parts on the next screen."
      />
      <Card className="max-w-3xl">
        <CardHeader eyebrow="Product" title="Details" />
        <CardBody>
          <ProductForm />
        </CardBody>
      </Card>
    </>
  );
}
