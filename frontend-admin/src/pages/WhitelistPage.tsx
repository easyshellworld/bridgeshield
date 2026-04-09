import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin-api';
import WhitelistTable from '../components/WhitelistTable';

export default function WhitelistPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: whitelist = [] } = useQuery({
    queryKey: ['whitelist'],
    queryFn: adminApi.getWhitelist,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Whitelist</h1>
        <button className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-600 text-sm font-medium">
          Add Address
        </button>
      </div>

      <div className="max-w-md">
        <input
          type="text"
          placeholder="Search by address or label..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <WhitelistTable entries={whitelist} searchQuery={searchQuery} />
    </div>
  );
}