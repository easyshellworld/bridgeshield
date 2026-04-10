import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin-api';

export default function LogsPage() {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'>('ALL');

  const { data: logs = [], error } = useQuery({
    queryKey: ['logs'],
    queryFn: adminApi.getLogs,
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesRiskLevel = selectedRiskLevel === 'ALL' || log.riskLevel === selectedRiskLevel;
      const matchesDate = !selectedDate || log.createdAt.slice(0, 10) === selectedDate;
      return matchesRiskLevel && matchesDate;
    });
  }, [logs, selectedDate, selectedRiskLevel]);

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case 'LOW':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">LOW</span>;
      case 'MEDIUM':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">MEDIUM</span>;
      case 'HIGH':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">HIGH</span>;
      default:
        return null;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'ALLOW':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">ALLOW</span>;
      case 'REVIEW':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">REVIEW</span>;
      case 'BLOCK':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">BLOCK</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Check Logs</h1>
        <div className="flex gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <select
            value={selectedRiskLevel}
            onChange={(event) => setSelectedRiskLevel(event.target.value as typeof selectedRiskLevel)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
      </div>

      {error instanceof Error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Factors</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processing Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cached</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.checkId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{log.address.slice(0, 8)}...{log.address.slice(-6)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.chainId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.riskScore}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getRiskLevelBadge(log.riskLevel)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {log.riskFactors.length > 0 ? log.riskFactors.join(', ') : 'None'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.processingTimeMs}ms</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.cached ? <span className="text-green-600">Yes</span> : 'No'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}

            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">
                  No log entries match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
