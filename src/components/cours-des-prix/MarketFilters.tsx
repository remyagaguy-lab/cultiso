'use client';

import { useState } from 'react';
import { Select, Drawer, Button } from 'antd';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { Product } from '@/types/prices';
import { PriceFilters } from '@/hooks/usePriceFilters';

interface MarketFiltersProps {
  products: Product[];
  locations: string[];
  filters: PriceFilters;
  onFilterChange: (key: keyof PriceFilters, value?: string) => void;
  onReset: () => void;
}

export default function MarketFilters({
  products,
  locations,
  filters,
  onFilterChange,
  onReset
}: MarketFiltersProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const hiddenCategories = ['SERVICE AGRICOLE', 'CHARGE FIXE', 'INTRANT', 'SEMENCE'];

  // 1. Filtrer les catégories pour n'afficher que celles pertinentes au dashboard
  const categories = Array.from(new Set(products.map(p => p.category)))
    .filter(Boolean)
    .filter(c => !hiddenCategories.includes(c as string))
    .sort();
  const categoryOptions = categories.map((c) => ({ value: c, label: c }));

  // 2. Cascade : ne montrer que les produits de la catégorie sélectionnée (si existante)
  // et cacher les produits du simulateur
  const availableProducts = products
    .filter(p => !hiddenCategories.includes(p.category))
    .filter(p => (filters.category ? p.category === filters.category : true));
    
  const productOptions = availableProducts.map((p) => ({ value: p.id, label: p.name }));
  const locationOptions = locations.map((l) => ({ value: l, label: l }));
  
  // Gérer le changement de catégorie : si on change la catégorie, on réinitialise le produit
  const handleCategoryChange = (val?: string) => {
    onFilterChange('category', val);
    if (val && filters.productId) {
      // Vérifier si le produit actuel fait partie de la nouvelle catégorie
      const productStillValid = availableProducts.find(p => p.category === val && p.id === filters.productId);
      if (!productStillValid) {
        onFilterChange('productId', undefined);
      }
    }
  };

  const filterContent = (
    <div className="flex flex-col gap-5 w-full">
      <div>
        <label className="block text-[13px] font-medium text-foreground mb-1.5">Catégorie</label>
        <Select
          allowClear
          className="w-full"
          placeholder="Toutes les catégories"
          value={filters.category}
          onChange={handleCategoryChange}
          options={categoryOptions}
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-foreground mb-1.5">Produit</label>
        <Select
          allowClear
          showSearch
          className="w-full"
          placeholder="Tous les produits"
          value={filters.productId}
          onChange={(val) => onFilterChange('productId', val)}
          options={productOptions}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-foreground mb-1.5">Lieu / Marché</label>
        <Select
          allowClear
          showSearch
          className="w-full"
          placeholder="Tous les lieux"
          value={filters.location}
          onChange={(val) => onFilterChange('location', val)}
          options={locationOptions}
        />
      </div>
      <div className="pt-2">
        <Button 
          icon={<ReloadOutlined />} 
          onClick={onReset}
          className="w-full !bg-sunken hover:!bg-[var(--ork-use-background-neutral-default-hover)] !text-foreground !border-border-strong rounded-[var(--ork-use-radius-button)]"
        >
          Réinitialiser
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Version Desktop (Sidebar) */}
      <div className="hidden lg:block bg-surface p-6 rounded-[var(--ork-use-radius-card)] shadow-raised border border-border">
        <h3 className="font-title font-medium text-lg text-foreground mb-5">Filtres</h3>
        {filterContent}
      </div>

      {/* Version Mobile & Tablette (Bouton + Drawer) */}
      <div className="lg:hidden mb-4">
        <Button 
          type="primary" 
          icon={<FilterOutlined />} 
          onClick={() => setMobileDrawerOpen(true)}
          className="w-full bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action border-none rounded-[var(--ork-use-radius-button)] shadow-none"
        >
          Filtrer les prix
        </Button>
      </div>

      <Drawer
        title="Filtres"
        placement="bottom"
        size="default"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        className="lg:hidden"
      >
        {filterContent}
      </Drawer>
    </>
  );
}
