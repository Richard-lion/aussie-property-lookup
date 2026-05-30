'use client';

import { useEffect, useState } from 'react';
import { fetchProperty, PropertyData } from '@/lib/api';

interface PropertyPageClientProps {
  address: string;
}

export default function PropertyPageClient({ address }: PropertyPageClientProps) {
  const [data, setData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProperty(address).then((result) => {
      setData(result);
      setLoading(false);
    }).catch(() => {
      setError('无法加载房产数据');
      setLoading(false);
    });
  }, [address]);

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-base px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 bg-bg-hover rounded" />
            <div className="h-8 w-64 bg-bg-hover rounded" />
            <div className="h-4 w-48 bg-bg-hover rounded" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-base px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <a href="/" className="text-text-secondary hover:text-accent text-sm transition-colors">
          ← 返回搜索
        </a>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <h1 className="font-display font-bold text-3xl text-text-primary">{address}</h1>
          {data && (
            <p className="text-text-secondary text-sm">
              {data.totalSold > 0
                ? `共 ${data.totalSold} 条成交记录`
                : '暂无成交数据'}
              {data.source === 'allhomes' && ' · 数据来源：Allhomes'}
            </p>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          {data ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <p className="font-display font-bold text-2xl">{data.beds ?? '-'}</p>
                <p className="text-text-secondary text-xs">卧室</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl">{data.baths ?? '-'}</p>
                <p className="text-text-secondary text-xs">浴室</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl">{data.cars ?? '-'}</p>
                <p className="text-text-secondary text-xs">车位</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl">{data.landArea ?? '-'}</p>
                <p className="text-text-secondary text-xs">土地</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl">{data.propertyType ?? '-'}</p>
                <p className="text-text-secondary text-xs">类型</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-text-secondary">暂无数据</p>
          )}
        </div>

        {/* Price Panel */}
        {data && (
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-display font-bold text-lg text-text-primary mb-4">价格历史</h2>
            {data.soldPrices.length > 0 ? (
              <div className="space-y-2">
                {data.soldPrices.map((sale, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-text-primary font-medium">
                        {sale.price ? `$${sale.price.toLocaleString()}` : '-'}
                      </p>
                      {sale.address && (
                        <p className="text-text-secondary text-xs">{sale.address}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {sale.date && <p className="text-text-secondary text-xs">{sale.date}</p>}
                      <p className="text-text-secondary text-xs">{sale.beds ?? '-'}床 {sale.baths ?? '-'}浴</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm text-center py-4">暂无成交记录</p>
            )}
            {data.estimatedRange && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-text-secondary text-xs">
                  参考价格区间：
                  <span className="text-accent font-medium ml-1">
                    ${data.estimatedRange.min.toLocaleString()} ~ ${data.estimatedRange.max.toLocaleString()}
                  </span>
                </p>
              </div>
            )}
            {data.searchUrl && (
              <a
                href={data.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block text-center text-accent hover:underline text-sm"
              >
                在 Allhomes 查看全部 →
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}