interface StatsCardProps {
  title: string;
  value: number | string;
  trend?: number;
  unit?: string;
}

export default function StatsCard({ title, value, trend, unit = '' }: StatsCardProps) {
  const isTrendPositive = trend ? trend > 0 : false;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <p className="text-sm text-gray-600 font-medium mb-2">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={`mt-2 text-sm font-medium ${isTrendPositive ? 'text-success' : 'text-danger'}`}>
          {isTrendPositive ? '↑' : '↓'} {Math.abs(trend)}% vs yesterday
        </div>
      )}
    </div>
  );
}