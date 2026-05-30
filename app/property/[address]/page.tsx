import PricePanel from '@/components/PricePanel';
import PropertyBasicInfo from '@/components/PropertyBasicInfo';
import SuburbStats from '@/components/SuburbStats';

interface Props {
  params: { address: string };
}

async function getPropertyData(address: string) {
  return null;
}

export default async function PropertyPage({ params }: Props) {
  const address = decodeURIComponent(params.address);
  const data = await getPropertyData(address);

  return (
    <main className="min-h-screen bg-bg-base px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <a href="/" className="text-text-secondary hover:text-accent text-sm transition-colors">
          ← 返回搜索
        </a>

        <div className="space-y-1">
          <h1 className="font-display font-bold text-3xl text-text-primary">{address}</h1>
          <p className="text-text-secondary">房产详情</p>
        </div>

        <PropertyBasicInfo data={data} />

        <PricePanel
          currentPrice={data?.currentPrice}
          soldPrices={data?.soldPrices}
          estimatedRange={data?.estimatedRange}
        />

        <SuburbStats data={data?.suburbStats} />
      </div>
    </main>
  );
}