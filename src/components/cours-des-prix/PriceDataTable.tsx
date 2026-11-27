'use client';

import { Table, Tag, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PriceRecord } from '@/types/prices';

interface PriceDataTableProps {
  data: PriceRecord[];
  loading: boolean;
}

export default function PriceDataTable({ data, loading }: PriceDataTableProps) {
  const getCategoryColor = (category: string) => {
    const upperCategory = category.toUpperCase();
    switch (upperCategory) {
      case 'CEREALE':
        return 'gold';
      case 'INTRANT':
        return 'blue';
      case 'TUBERCULE':
        return 'orange';
      case 'AUTRE':
        return 'green';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<PriceRecord> = [
    {
      title: 'Produit',
      dataIndex: ['product', 'name'],
      key: 'product_name',
      render: (text) => <span className="font-medium text-foreground">{text || 'Inconnu'}</span>,
    },
    {
      title: 'Catégorie',
      dataIndex: ['product', 'category'],
      key: 'category',
      responsive: ['sm'],
      render: (category: string) => {
        if (!category) return null;
        const label = category.toUpperCase() === 'CEREALE' ? 'CÉRÉALE' : category.toUpperCase();
        return <Tag color={getCategoryColor(category)}>{label}</Tag>;
      },
    },
    {
      title: 'Prix',
      key: 'price',
      render: (_, record) => (
        <span className="font-medium font-mono-numbers text-t-brand">
          {record.price.toLocaleString('fr-FR')} FCFA <span className="text-[13px] font-normal text-muted font-sans">/ {record.product?.default_unit || 'unité'}</span>
        </span>
      ),
    },
    {
      title: 'Lieu',
      key: 'location',
      render: (_, record) => {
        return <span className="text-muted">{record.location || 'Non spécifié'}</span>;
      }
    },
    {
      title: 'Date',
      key: 'record_date',
      responsive: ['md'],
      render: (_, record) => {
        if (!record.record_date) return <span className="text-muted">-</span>;
        const date = new Date(record.record_date);
        return <span className="text-muted">{date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
      }
    },
  ];

  if (!loading && data.length === 0) {
    return (
      <div className="bg-surface p-8 rounded-[var(--ork-use-radius-card)] shadow-raised border border-border flex items-center justify-center">
        <Empty 
          description={<span className="text-muted">Aucun relevé de prix ne correspond à vos filtres.</span>}
        />
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-[var(--ork-use-radius-card)] shadow-raised border border-border overflow-hidden">
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['15', '30', '50'],
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
