import { motion } from 'framer-motion';
import { Stats } from '../types';

interface LiveStatsProps {
  stats: Stats;
}

const LiveStats = ({ stats }: LiveStatsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="w-full bg-card border-t border-white/10 py-4 px-6"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-secondary mb-1">TOTAL CHECKS</p>
            <p className="font-mono text-xl font-bold">{stats.totalChecks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">BLOCKED TRANSACTIONS</p>
            <p className="font-mono text-xl font-bold text-danger">{stats.totalBlocks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">AVG RESPONSE TIME</p>
            <p className="font-mono text-xl font-bold text-primary">{stats.averageResponseTimeMs}ms</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stats.status === 'online' ? 'bg-primary animate-pulse' : 'bg-danger'}`}></div>
          <span className="text-sm font-medium">
            Service {stats.status === 'online' ? 'Online' : 'Offline (Demo Mode)'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveStats;
