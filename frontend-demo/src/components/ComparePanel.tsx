import { motion } from 'framer-motion';
import { AMLCheckResult } from '../types';
import RiskScoreMeter from './RiskScoreMeter';
import FactorList from './FactorList';

interface ComparePanelProps {
  address: string;
  result?: AMLCheckResult | null;
  isLoading: boolean;
  type: 'with' | 'without';
}

const ComparePanel = ({ address, result, isLoading, type }: ComparePanelProps) => {
  const isWith = type === 'with';

  const getMockWithoutResult = () => {
    return {
      riskScore: 0,
      riskLevel: 'LOW',
      action: 'ALLOW' as const,
      riskFactors: ['No AML check performed', 'Transaction approved automatically'],
      recommendation: 'Transaction would be allowed without any risk checks.',
      processingTimeMs: 0,
      cached: false,
      address
    } as AMLCheckResult;
  };

  const displayResult = isWith ? result : getMockWithoutResult();

  return (
    <motion.div
      initial={{ opacity: 0, x: isWith ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 p-6 rounded-xl border border-white/10 bg-card"
    >
      <div className="mb-6 text-center">
        <h3 className={`text-2xl font-bold mb-2 ${isWith ? 'text-primary' : 'text-danger'}`}>
          {isWith ? 'WITH BridgeShield' : 'WITHOUT BridgeShield'}
        </h3>
        <p className="text-secondary text-sm">
          {isWith ? 'AML risk checks enabled' : 'No AML protection'}
        </p>
      </div>

      <div className="flex justify-center mb-8">
        {isLoading ? (
          <div className="w-28 h-28 border-4 border-white/10 border-t-primary rounded-full animate-spin"></div>
        ) : displayResult ? (
          <RiskScoreMeter score={displayResult.riskScore} size={200} strokeWidth={18} />
        ) : null}
      </div>

      {displayResult && !isLoading && (
        <>
          <div className="mb-6 text-center">
            <div className={`inline-block px-6 py-3 rounded-lg font-bold text-xl mb-2 ${
              displayResult.action === 'BLOCK' ? 'bg-danger/20 text-danger border border-danger/30' :
              displayResult.action === 'REVIEW' ? 'bg-warning/20 text-warning border border-warning/30' :
              'bg-primary/20 text-primary border border-primary/30'
            }`}>
              {displayResult.action}
            </div>
            <p className="text-secondary text-sm">{displayResult.riskLevel} RISK</p>
          </div>

          <div className="mb-6">
            <h4 className="font-medium mb-2">Risk Factors:</h4>
            <FactorList factors={displayResult.riskFactors} />
          </div>

          <div className="p-4 bg-black/20 rounded-lg border border-white/10">
            <p className="text-sm text-secondary">{displayResult.recommendation}</p>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default ComparePanel;
