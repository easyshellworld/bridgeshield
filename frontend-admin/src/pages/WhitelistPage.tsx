import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin-api';
import WhitelistTable from '../components/WhitelistTable';
import type { WhitelistEntry } from '../types';

type WhitelistFormType = Exclude<WhitelistEntry['type'], 'APPEAL_TEMPORARY'>;

const DEFAULT_FORM = {
  address: '',
  type: 'KNOWN_PROTOCOL' as WhitelistFormType,
  label: '',
  chainId: '1',
};

export default function WhitelistPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const queryClient = useQueryClient();

  const { data: whitelist = [], error } = useQuery({
    queryKey: ['whitelist'],
    queryFn: adminApi.getWhitelist,
  });

  const addMutation = useMutation({
    mutationFn: () => adminApi.addToWhitelist({
      address: formValues.address.trim(),
      type: formValues.type,
      label: formValues.label.trim(),
      chainId: Number(formValues.chainId) || 1,
      expiresAt: undefined,
    }),
    onSuccess: async () => {
      setFormValues(DEFAULT_FORM);
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Whitelist</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-600 text-sm font-medium"
          onClick={() => setShowForm((current) => !current)}
        >
          {showForm ? 'Cancel' : 'Add Address'}
        </button>
      </div>

      {error instanceof Error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {showForm && (
        <form
          className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            addMutation.mutate();
          }}
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
            <input
              type="text"
              required
              value={formValues.address}
              onChange={(event) => setFormValues((current) => ({ ...current, address: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-4 py-2 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0x..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              value={formValues.type}
              onChange={(event) => setFormValues((current) => ({ ...current, type: event.target.value as WhitelistFormType }))}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="KNOWN_PROTOCOL">Known Protocol</option>
              <option value="LIFI_OFFICIAL">LI.FI Official</option>
              <option value="BRIDGE_CONTRACT">Bridge Contract</option>
              <option value="APPEAL_APPROVED">Appeal Approved</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Chain ID</label>
            <input
              type="number"
              min="1"
              value={formValues.chainId}
              onChange={(event) => setFormValues((current) => ({ ...current, chainId: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Label</label>
            <input
              type="text"
              required
              value={formValues.label}
              onChange={(event) => setFormValues((current) => ({ ...current, label: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Describe why this address is safe"
            />
          </div>

          {addMutation.error instanceof Error && (
            <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {addMutation.error.message}
            </div>
          )}

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addMutation.isPending ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        </form>
      )}

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
