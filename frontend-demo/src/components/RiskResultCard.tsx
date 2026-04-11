import { motion } from 'framer-motion';
import { AMLCheckResult } from '../types';
import FactorList from './FactorList';

interface RiskResultCardProps {
  result: AMLCheckResult;
}

const RiskResultCard = ({ result }: RiskResultCardProps) => {
  const getActionColors = () => {
    switch (result.action) {
      case 'BLOCK':
        return {
          bg: 'bg-danger/10',
          border: 'border-danger/30',
          text: 'text-danger',
          glow: 'shadow-glow-danger'
        };
      case 'REVIEW':
        return {
          bg: 'bg-warning/10',
          border: 'border-warning/30',
          text: 'text-warning',
          glow: 'shadow-glow-warning'
        };
      case 'ALLOW':
        return {
          bg: 'bg-primary/10',
          border: 'border-primary/30',
          text: 'text-primary',
          glow: 'shadow-glow'
        };
    }
  };

  const colors = getActionColors();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`w-full p-6 rounded-xl ${colors.bg} ${colors.border} border ${colors.glow}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1">
            <span className={colors.text}>{result.action}</span> • {result.riskLevel} RISK
          </h3>
          <p className="text-secondary text-sm">
            Check completed in {result.processingTimeMs}ms • {result.cached ? 'Cached result' : 'Live scan'}
            {result.fallback && ` • ${result.fallbackReason}`}
          </p>
          {result.behaviorEscalated && result.baseAction && (
            <p className="text-warning text-sm mt-1">
              Behavior escalation: {result.baseAction} → {result.action}
            </p>
          )}
        </div>
        <div className={`px-4 py-2 rounded-lg ${colors.bg} ${colors.text} font-bold border ${colors.border}`}>
          {result.riskScore}/100
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-medium mb-2">Risk Factors:</h4>
        <FactorList factors={result.riskFactors} />
      </div>

      {result.recommendation && (
        <div className="p-4 bg-black/20 rounded-lg border border-white/10">
          <h4 className="font-medium mb-1">Recommendation:</h4>
          <p className="text-secondary text-sm">{result.recommendation}</p>
        </div>
      )}

      {result.behavior && (
        <div className="mt-4 p-4 bg-black/20 rounded-lg border border-white/10">
          <h4 className="font-medium mb-2">C-end Behavior Analysis:</h4>
          <p className="text-sm text-secondary mb-2">
            Score {result.behavior.score}/100 • {result.behavior.level} • confidence {result.behavior.confidence}
          </p>
          {result.behavior.signals.length > 0 ? (
            <FactorList factors={result.behavior.signals} />
          ) : (
            <p className="text-sm text-secondary">No abnormal behavior signals detected.</p>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default RiskResultCard;
