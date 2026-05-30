'use client';

import { Bed, Bathtub, Car, Ruler, Wrench } from '@phosphor-icons/react';

interface PropertyBasicInfoProps {
  data: {
    beds?: number;
    baths?: number;
    cars?: number;
    landArea?: string;
    yearBuilt?: number;
  } | null;
}

export default function PropertyBasicInfo({ data }: PropertyBasicInfoProps) {
  if (!data) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-secondary">
        加载中...
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <div className="text-center">
          <p className="text-3xl mb-1"><Bed weight="duotone" /></p>
          <p className="font-display font-bold text-2xl">{data.beds ?? '-'}</p>
          <p className="text-text-secondary text-xs">卧室</p>
        </div>
        <div className="text-center">
          <p className="text-3xl mb-1"><Bathtub weight="duotone" /></p>
          <p className="font-display font-bold text-2xl">{data.baths ?? '-'}</p>
          <p className="text-text-secondary text-xs">浴室</p>
        </div>
        <div className="text-center">
          <p className="text-3xl mb-1"><Car weight="duotone" /></p>
          <p className="font-display font-bold text-2xl">{data.cars ?? '-'}</p>
          <p className="text-text-secondary text-xs">车位</p>
        </div>
        <div className="text-center">
          <p className="text-3xl mb-1"><Ruler weight="duotone" /></p>
          <p className="font-display font-bold text-2xl">{data.landArea ?? '-'}</p>
          <p className="text-text-secondary text-xs">土地</p>
        </div>
        <div className="text-center">
          <p className="text-3xl mb-1"><Wrench weight="duotone" /></p>
          <p className="font-display font-bold text-2xl">{data.yearBuilt ?? '-'}</p>
          <p className="text-text-secondary text-xs">建造年份</p>
        </div>
      </div>
    </div>
  );
}