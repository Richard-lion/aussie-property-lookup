interface StatCardProps {
  label: string;
  value: string;
  change?: { value: number; positive: boolean };
  unit?: string;
}

export default function StatCard({ label, value, change, unit }: StatCardProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 hover:border-accent transition-colors duration-150">
      <p className="text-text-secondary text-xs mb-1 uppercase tracking-wide">{label}</p>
      <p className="font-display font-bold text-2xl text-text-primary">
        {value}
        {unit && <span className="text-base text-text-secondary ml-1">{unit}</span>}
      </p>
      {change && (
        <p className={`text-xs mt-1 ${change.positive ? 'text-success' : 'text-danger'}`}>
          {change.positive ? '↑' : '↓'} {Math.abs(change.value)}%
        </p>
      )}
    </div>
  );
}