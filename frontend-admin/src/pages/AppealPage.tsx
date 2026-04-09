import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin-api';
import AppealTable from '../components/AppealTable';

const filters = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
] as const;

export default function AppealPage() {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const { data: appeals = [] } = useQuery({
    queryKey: ['appeals'],
    queryFn: adminApi.getAppeals,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Appeals</h1>
      </div>

      <div className="flex space-x-1 border-b border-gray-200">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeFilter === filter.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {filter.label}
            {filter.id !== 'ALL' && (
              <span className="ml-1 text-xs">
                ({appeals.filter(a => a.status === filter.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <AppealTable appeals={appeals} filter={activeFilter} />
    </div>
  );
}