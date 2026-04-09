import { useState } from 'react';
import { Link } from 'react-router-dom';
import AddressInput from '../components/AddressInput';
import ComparePanel from '../components/ComparePanel';
import CodeSnippet from '../components/CodeSnippet';
import { checkAddress } from '../api/bridgeshield';
import { AMLCheckResult } from '../types';

const COMPARE_INTEGRATION_CODE = `// LI.FI + BridgeShield Integration Example
import { LiFi } from '@lifi/sdk';
import { BridgeShield } from '@bridgeshield/sdk';

const lifi = new LiFi();
const shield = new BridgeShield('YOUR_API_KEY');

// Check address before executing swap
const riskCheck = await shield.checkAddress(userAddress, chainId);
if (riskCheck.action === 'BLOCK') {
  alert('Transaction blocked: High AML risk');
  return;
}

// Proceed with LI.FI swap if allowed
const routes = await lifi.getRoutes(...);
await lifi.executeRoute(...);`;

const ComparePage = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [result, setResult] = useState<AMLCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = async (addr: string) => {
    setAddress(addr);
    setIsChecking(true);
    try {
      const res = await checkAddress(addr);
      setResult(res);
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
            <Link to="/" className="text-secondary hover:text-white transition-colors">Check</Link>
            <Link to="/compare" className="text-primary font-medium">Compare vs LI.FI</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              See the difference <span className="text-primary">protection makes</span>
            </h2>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              Compare what happens with and without BridgeShield AML protection for your LI.FI transactions.
            </p>
          </div>

          <AddressInput onSubmit={handleCheck} isLoading={isChecking} />

          {address && (
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              <ComparePanel 
                address={address} 
                result={result} 
                isLoading={isChecking} 
                type="without" 
              />
              <ComparePanel 
                address={address} 
                result={result} 
                isLoading={isChecking} 
                type="with" 
              />
            </div>
          )}

          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center mb-6">LI.FI Integration Code</h3>
            <CodeSnippet code={COMPARE_INTEGRATION_CODE} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComparePage;
