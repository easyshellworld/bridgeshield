import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin-api';
import StatsCard from '../components/StatsCard';
import RiskTrendChart from '../components/RiskTrendChart';
import RiskDistributionPie from '../components/RiskDistributionPie';

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: adminApi.getDashboardStats,
  });

  const { data: trendData } = useQuery({
    queryKey: ['risk-trend'],
    queryFn: adminApi.getRiskTrend,
  });

  const { data: distributionData } = useQuery({
    queryKey: ['risk-distribution'],
    queryFn: adminApi.getRiskDistribution,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Today's Checks"
          value={stats?.todayChecks || 0}
          trend={stats?.checksTrend}
        />
        <StatsCard
          title="Today's Blocks"
          value={stats?.todayBlocks || 0}
          trend={stats?.blocksTrend}
        />
        <StatsCard
          title="Cache Hit Rate"
          value={stats?.cacheHitRate || 0}
          unit="%"
        />
        <StatsCard
          title="Avg Response Time"
          value={stats?.avgResponseTime || 0}
          unit="ms"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trendData && <RiskTrendChart data={trendData} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {distributionData?.levels && (
          <RiskDistributionPie title="Risk Level Distribution" data={distributionData.levels} />
        )}
        {distributionData?.sources && (
          <RiskDistributionPie title="Risk Source Distribution" data={distributionData.sources} />
        )}
      </div>
    </div>
  );
}