import StatCard from './StatCard';

interface SuburbStatsData {
  medianPrice: string;
  medianChange?: number;
  volume6m: number;
  rentalYield?: string;
  vacancyRate?: string;
}

export default function SuburbStats({ data }: { data: SuburbStatsData | null | undefined }) {
  if (!data) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-text-secondary">
        暂无 Suburb 数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display font-semibold text-lg text-text-primary">Suburb 投资看板</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="中位价"
          value={data.medianPrice}
          change={data.medianChange ? { value: Math.abs(data.medianChange), positive: data.medianChange > 0 } : undefined}
        />
        <StatCard label="近6月成交" value={String(data.volume6m)} unit="套" />
        <StatCard label="租金回报率" value={data.rentalYield ?? '-'} />
        <StatCard label="空租率" value={data.vacancyRate ?? '-'} />
      </div>
    </div>
  );
}