interface PricePanelProps {
  currentPrice?: { amount: string; source: string } | null;
  soldPrices?: { price: string; date: string }[];
  estimatedRange?: { low: string; high: string };
}

export default function PricePanel({ currentPrice, soldPrices = [], estimatedRange }: PricePanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <p className="text-text-secondary text-sm mb-2">当前在售</p>
        {currentPrice ? (
          <>
            <p className="font-display font-bold text-2xl text-success">{currentPrice.amount}</p>
            <p className="text-text-secondary text-xs mt-1">来源：{currentPrice.source}</p>
          </>
        ) : (
          <p className="text-text-secondary">暂无在售信息</p>
        )}
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-5">
        <p className="text-text-secondary text-sm mb-2">近期成交</p>
        {soldPrices.length > 0 ? (
          <div className="space-y-2">
            {soldPrices.slice(0, 3).map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-display text-accent">{s.price}</span>
                <span className="text-text-secondary text-xs">{s.date}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-secondary">价格未公开（私人成交）</p>
        )}
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-5">
        <p className="text-text-secondary text-sm mb-2">估值参考</p>
        {estimatedRange ? (
          <>
            <p className="font-display text-xl text-text-primary">
              {estimatedRange.low} — {estimatedRange.high}
            </p>
            <p className="text-text-secondary text-xs mt-1">来源：PropertyValue</p>
          </>
        ) : (
          <p className="text-text-secondary">暂无估值数据</p>
        )}
      </div>
    </div>
  );
}