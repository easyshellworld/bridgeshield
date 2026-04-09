import { useState } from 'react';
import { motion } from 'framer-motion';
import { DEMO_ADDRESSES } from '../constants/demo-addresses';

interface AddressInputProps {
  onSubmit: (address: string) => void;
  isLoading?: boolean;
}

const AddressInput = ({ onSubmit, isLoading = false }: AddressInputProps) => {
  const [address, setAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      onSubmit(address.trim());
    }
  };

  const handlePresetClick = (addr: string) => {
    setAddress(addr);
    onSubmit(addr);
  };

  const getBadgeColor = (badge: string) => {
    if (badge === 'HACKER' || badge === 'MIXER') return 'bg-danger/20 text-danger border-danger/30';
    return 'bg-primary/20 text-primary border-primary/30';
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter wallet address or contract address..."
            className="flex-1 px-4 py-4 bg-card border border-white/10 rounded-lg text-white placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
            disabled={isLoading}
          />
          <motion.button
            type="submit"
            disabled={isLoading || !address.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-4 bg-primary text-background font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? 'CHECKING...' : 'CHECK'}
          </motion.button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {DEMO_ADDRESSES.map((demo, index) => (
          <motion.button
            key={index}
            onClick={() => handlePresetClick(demo.address)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`p-3 rounded-lg border text-left ${getBadgeColor(demo.badge)} transition-all`}
            disabled={isLoading}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{demo.label}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-black/20">{demo.badge}</span>
            </div>
            <p className="text-xs opacity-80 mb-1">{demo.description}</p>
            <p className="text-xs font-mono truncate">{demo.address.slice(0, 10)}...{demo.address.slice(-8)}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default AddressInput;
