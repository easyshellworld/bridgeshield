import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import AddressInput from '../components/AddressInput';
import RiskScoreMeter from '../components/RiskScoreMeter';
import RiskResultCard from '../components/RiskResultCard';
import CodeSnippet from '../components/CodeSnippet';
import LiveStats from '../components/LiveStats';
import { checkAddress, getStats } from '../api/bridgeshield';
import { AMLCheckResult, Stats } from '../types';

const INTEGRATION_CODE = `// Add BridgeShield to your LI.FI integration
import { BridgeShieldClient } from '@bridgeshield/sdk';

const shield = new BridgeShieldClient({
  baseUrl: 'https://api.bridgeshield.io',
  apiKey: 'YOUR_API_KEY',
});
const result = await shield.checkAddress({ address: userAddress, chainId });

if (result.decision === 'BLOCK') {
  // Block high risk transactions
  throw new Error('Address blocked due to AML risk');
}`;

const CheckerPage = () => {
  const [result, setResult] = useState<AMLCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: stats, error: statsError } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 5000,
    retry: false,
  });

  const handleCheck = async (addr: string) => {
    setIsChecking(true);
    setErrorMessage(null);
    try {
      const res = await checkAddress(addr);
      setResult(res);
    } catch (error) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to check address');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-6 px-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" stroke="#00D4AA" strokeWidth="2" fill="rgba(0, 212, 170, 0.1)"/>
                <path d="M12 6L16.5 9V15L12 18L7.5 15V9L12 6Z" fill="#00D4AA"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">BridgeShield</h1>
              <p className="text-secondary text-xs">AML Gateway for LI.FI</p>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-primary font-medium">Check</Link>
            <Link to="/compare" className="text-secondary hover:text-white transition-colors">Compare vs LI.FI</Link>
            <Link to="/earn-flow" className="text-secondary hover:text-white transition-colors">Earn Flow</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Stop <span className="text-danger">stolen funds</span> before they enter your protocol
            </h2>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              Real-time AML + C-end behavior screening for every cross-chain transaction. Seamless integration with LI.FI.
            </p>
          </motion.div>

          <AddressInput onSubmit={handleCheck} isLoading={isChecking} />
          {errorMessage && (
            <div className="mt-4 p-4 rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm">
              {errorMessage}
            </div>
          )}
          {statsError instanceof Error && (
            <div className="mt-4 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning text-sm">
              Live stats unavailable: {statsError.message}
            </div>
          )}

          {result && !isChecking && (
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto items-center">
              <div className="flex justify-center">
                <RiskScoreMeter score={result.riskScore} />
              </div>
              <div>
                <RiskResultCard result={result} />
              </div>
            </div>
          )}

          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center mb-6">Integrate in 3 lines of code</h3>
            <CodeSnippet code={INTEGRATION_CODE} />
          </div>
        </div>
      </main>

      {stats && <LiveStats stats={stats} />}
    </div>
  );
};

export default CheckerPage;
