import { SubNav } from '@/components/ui/sub-nav';

export function InventoryNav({
  active,
  lowStock,
  openPurchases,
}: {
  active: 'parts' | 'bom' | 'purchasing';
  lowStock?: number;
  openPurchases?: number;
}) {
  return (
    <SubNav
      active={active}
      items={[
        { key: 'parts', href: '/inventory', label: 'Parts and stock', count: lowStock },
        { key: 'bom', href: '/inventory/bom', label: 'Bills of materials' },
        { key: 'purchasing', href: '/inventory/purchasing', label: 'Purchasing', count: openPurchases },
      ]}
    />
  );
}
