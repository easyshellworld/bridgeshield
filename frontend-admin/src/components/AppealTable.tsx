import { Fragment, useState } from 'react';
import { Appeal } from '../types';
import { adminApi } from '../api/admin-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface AppealTableProps {
  appeals: Appeal[];
  filter: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export default function AppealTable({ appeals, filter }: AppealTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const filteredAppeals = filter === 'ALL' ? appeals : appeals.filter(a => a.status === filter);

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveAppeal(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appeals'] }),
        queryClient.invalidateQueries({ queryKey: ['whitelist'] }),
        queryClient.invalidateQueries({ queryKey: ['logs'] }),
      ]);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectAppeal(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appeals'] }),
        queryClient.invalidateQueries({ queryKey: ['whitelist'] }),
        queryClient.invalidateQueries({ queryKey: ['logs'] }),
      ]);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>;
      case 'APPROVED':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Approved</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredAppeals.map((appeal) => (
            <Fragment key={appeal.id}>
              <tr key={appeal.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === appeal.id ? null : appeal.id)}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{appeal.ticketId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{appeal.address.slice(0, 6)}...{appeal.address.slice(-4)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(appeal.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(appeal.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {appeal.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); approveMutation.mutate(appeal.id); }}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-xs font-medium"
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(appeal.id); }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs font-medium"
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {expandedId === appeal.id && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 bg-gray-50">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-2">Appeal Reason:</p>
                      <p className="text-gray-700 mb-4">{appeal.reason}</p>
                      {appeal.contact && (
                        <p className="text-gray-700 mb-2"><strong>Contact:</strong> {appeal.contact}</p>
                      )}
                      {appeal.reviewNote && (
                        <div className="mt-4 p-3 bg-gray-100 rounded-md">
                          <p className="font-medium text-gray-900 mb-1">Review Note:</p>
                          <p className="text-gray-700">{appeal.reviewNote}</p>
                          {appeal.reviewedAt && (
                            <p className="text-xs text-gray-500 mt-2">Reviewed on {new Date(appeal.reviewedAt).toLocaleString()}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}

          {filteredAppeals.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                No appeals match the selected filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {(approveMutation.error instanceof Error || rejectMutation.error instanceof Error) && (
        <div className="border-t border-gray-200 px-6 py-3 text-sm text-red-600">
          {approveMutation.error instanceof Error ? approveMutation.error.message : rejectMutation.error instanceof Error ? rejectMutation.error.message : ''}
        </div>
      )}
    </div>
  );
}
