import { WhitelistEntry } from '../types';
import { adminApi } from '../api/admin-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface WhitelistTableProps {
  entries: WhitelistEntry[];
  searchQuery: string;
}

export default function WhitelistTable({ entries, searchQuery }: WhitelistTableProps) {
  const queryClient = useQueryClient();

  const filteredEntries = entries.filter(
    entry => entry.address.toLowerCase().includes(searchQuery.toLowerCase()) || 
             entry.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const removeMutation = useMutation({
    mutationFn: (id: string) => adminApi.removeFromWhitelist(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whitelist'] }),
  });

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      LIFI_OFFICIAL: 'bg-blue-100 text-blue-800',
      KNOWN_PROTOCOL: 'bg-purple-100 text-purple-800',
      BRIDGE_CONTRACT: 'bg-green-100 text-green-800',
      APPEAL_APPROVED: 'bg-yellow-100 text-yellow-800',
      APPEAL_TEMPORARY: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {type.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chain</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredEntries.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                {entry.address.slice(0, 10)}...{entry.address.slice(-8)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(entry.type)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.label}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {entry.chainId ? `Chain ID: ${entry.chainId}` : 'All'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(entry.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => removeMutation.mutate(entry.id)}
                  className="text-red-600 hover:text-red-900"
                  disabled={removeMutation.isPending}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}

          {filteredEntries.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                No whitelist entries match the current search.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {removeMutation.error instanceof Error && (
        <div className="border-t border-gray-200 px-6 py-3 text-sm text-red-600">
          {removeMutation.error.message}
        </div>
      )}
    </div>
  );
}
