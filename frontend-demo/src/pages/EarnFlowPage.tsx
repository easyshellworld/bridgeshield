import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CodeSnippet from '../components/CodeSnippet';
import {
  buildCompliantComposerQuote,
  getEarnPortfolio,
  getEarnVaultDetail,
  getEarnVaults
} from '../api/bridgeshield';
import {
  ComposerQuoteResponse,
  EarnPortfolioResponse,
  EarnVault,
  EarnVaultDetailResponse
} from '../types';

const DEFAULT_CHAIN_ID = '8453';
const DEFAULT_WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const POLL_INTERVAL_MS = 3000;
const RECEIPT_TIMEOUT_MS = 120000;

const EXPLORER_BY_CHAIN_ID: Record<number, string> = {
  1: 'https://etherscan.io',
  10: 'https://optimistic.etherscan.io',
  56: 'https://bscscan.com',
  100: 'https://gnosisscan.io',
  137: 'https://polygonscan.com',
  146: 'https://sonicscan.org',
  130: 'https://uniscan.xyz',
  480: 'https://worldscan.org',
  1868: 'https://soneium.blockscout.com',
  5000: 'https://mantlescan.xyz',
  59144: 'https://lineascan.build',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  43114: 'https://snowtrace.io'
};

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface ComposerTransactionRequest {
  to?: string;
  from?: string;
  data?: string;
  value?: string;
  gas?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
}

interface EthereumRpcError {
  code?: number;
  message?: string;
}

interface TransactionReceipt {
  status?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isValidEvmAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value);

const isHexString = (value: string): boolean => /^0x[0-9a-fA-F]+$/.test(value);

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getWalletProvider = (): Eip1193Provider => {
  const maybeProvider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!maybeProvider) {
    throw new Error('No EVM wallet detected. Please install and unlock MetaMask (or a compatible wallet).');
  }

  return maybeProvider;
};

const parseChainIdFromHex = (value: unknown): number => {
  if (typeof value !== 'string' || !isHexString(value)) {
    throw new Error('Wallet returned an invalid chain id.');
  }

  return Number.parseInt(value, 16);
};

const toHexChainId = (chainId: number): string => `0x${chainId.toString(16)}`;

const toRpcQuantity = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (isHexString(value)) {
    return value.toLowerCase();
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid transaction field value: ${value}`);
  }

  return `0x${BigInt(value).toString(16)}`;
};

const toExplorerTxUrl = (chainId: number, txHash: string): string | null => {
  const explorerBaseUrl = EXPLORER_BY_CHAIN_ID[chainId];
  if (!explorerBaseUrl) {
    return null;
  }

  return `${explorerBaseUrl}/tx/${txHash}`;
};

const getVaultKey = (vault: EarnVault): string => `${vault.chainId}:${vault.address.toLowerCase()}`;

const mergeVaults = (current: EarnVault[], incoming: EarnVault[]): EarnVault[] => {
  if (incoming.length === 0) {
    return current;
  }

  const merged = [...current];
  const existingKeys = new Set(current.map(getVaultKey));

  for (const vault of incoming) {
    const key = getVaultKey(vault);
    if (!existingKeys.has(key)) {
      merged.push(vault);
      existingKeys.add(key);
    }
  }

  return merged;
};

const extractComposerTransactionRequest = (quote?: Record<string, unknown>): ComposerTransactionRequest | null => {
  if (!quote) {
    return null;
  }

  if (isRecord(quote.transactionRequest)) {
    return quote.transactionRequest as ComposerTransactionRequest;
  }

  if (isRecord(quote.estimate) && isRecord(quote.estimate.transactionRequest)) {
    return quote.estimate.transactionRequest as ComposerTransactionRequest;
  }

  if (isRecord(quote.execution) && isRecord(quote.execution.transactionRequest)) {
    return quote.execution.transactionRequest as ComposerTransactionRequest;
  }

  return null;
};

const getRpcErrorMessage = (error: unknown): string | null => {
  if (!isRecord(error)) {
    return null;
  }

  const typedError = error as EthereumRpcError;
  return typeof typedError.message === 'string' ? typedError.message : null;
};

const waitForTransactionReceipt = async (
  provider: Eip1193Provider,
  txHash: string,
  timeoutMs: number = RECEIPT_TIMEOUT_MS
): Promise<TransactionReceipt> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash]
    });

    if (isRecord(receipt)) {
      return receipt as TransactionReceipt;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error('Timed out while waiting for transaction receipt.');
};

const formatApy = (value?: number | null): string => {
  if (typeof value !== 'number') {
    return 'N/A';
  }
  return `${value.toFixed(2)}%`;
};

const formatUsd = (value?: string): string => {
  if (!value) {
    return 'N/A';
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return parsed.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const toBaseUnits = (amount: string, decimals: number): string => {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Amount must be a positive number');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const paddedFraction = `${fraction}${'0'.repeat(decimals)}`.slice(0, decimals);
  const combined = `${whole}${paddedFraction}`.replace(/^0+/, '');
  const result = combined.length === 0 ? '0' : combined;

  if (BigInt(result) <= 0n) {
    throw new Error('Amount must be greater than zero');
  }

  return result;
};

const normalizeVaultDetail = (detail: EarnVaultDetailResponse | null, fallback: EarnVault | null): EarnVault | null => {
  if (!detail) {
    return fallback;
  }

  if (isRecord(detail) && isRecord(detail.data)) {
    return detail.data as unknown as EarnVault;
  }

  if (isRecord(detail)) {
    return detail as unknown as EarnVault;
  }

  return fallback;
};

const EarnFlowPage = () => {
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID);
  const [walletAddress, setWalletAddress] = useState(DEFAULT_WALLET);
  const [depositAmount, setDepositAmount] = useState('1');
  const [txHash, setTxHash] = useState('');
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [txStatus, setTxStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED' | null>(null);
  const [txExplorerUrl, setTxExplorerUrl] = useState<string | null>(null);

  const [vaults, setVaults] = useState<EarnVault[]>([]);
  const [vaultNextCursor, setVaultNextCursor] = useState<string | null>(null);
  const [vaultTotal, setVaultTotal] = useState<number | null>(null);
  const [selectedVault, setSelectedVault] = useState<EarnVault | null>(null);
  const [vaultDetail, setVaultDetail] = useState<EarnVaultDetailResponse | null>(null);
  const [quoteResponse, setQuoteResponse] = useState<ComposerQuoteResponse | null>(null);
  const [portfolioResponse, setPortfolioResponse] = useState<EarnPortfolioResponse | null>(null);

  const [isLoadingVaults, setIsLoadingVaults] = useState(false);
  const [isLoadingMoreVaults, setIsLoadingMoreVaults] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isBuildingQuote, setIsBuildingQuote] = useState(false);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detailedVault = useMemo(
    () => normalizeVaultDetail(vaultDetail, selectedVault),
    [selectedVault, vaultDetail]
  );

  const quoteCode = useMemo(() => {
    if (!quoteResponse?.quote) {
      return '// Composer ready-to-sign transactionRequest will appear here';
    }

    return JSON.stringify(quoteResponse.quote, null, 2);
  }, [quoteResponse]);

  const portfolioPreview = useMemo(() => {
    const rows = portfolioResponse?.positions ?? [];
    return rows.slice(0, 3).map((position, index) => {
      if (!isRecord(position)) {
        return `Position #${index + 1}`;
      }

      const vault = isRecord(position.vault) ? position.vault : undefined;
      const name = typeof vault?.name === 'string'
        ? vault.name
        : typeof position.name === 'string'
          ? position.name
          : `Position #${index + 1}`;
      const network = typeof vault?.network === 'string'
        ? vault.network
        : typeof position.network === 'string'
          ? position.network
          : 'unknown network';

      return `${name} (${network})`;
    });
  }, [portfolioResponse]);

  const clearPostVaultState = () => {
    setQuoteResponse(null);
    setPortfolioResponse(null);
    setTxHash('');
    setTxStatus(null);
    setTxExplorerUrl(null);
  };

  const connectWallet = async () => {
    setErrorMessage(null);
    setIsConnectingWallet(true);

    try {
      const provider = getWalletProvider();
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== 'string') {
        throw new Error('Wallet connection failed: no account returned.');
      }

      const connectedAddress = accounts[0];
      const chainHex = await provider.request({ method: 'eth_chainId' });
      const parsedChainId = parseChainIdFromHex(chainHex);

      setWalletAddress(connectedAddress);
      setWalletChainId(parsedChainId);
    } catch (error) {
      const message = getRpcErrorMessage(error);
      setErrorMessage(message || (error instanceof Error ? error.message : 'Failed to connect wallet'));
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const ensureWalletOnChain = async (provider: Eip1193Provider, targetChainId: number) => {
    const currentChainHex = await provider.request({ method: 'eth_chainId' });
    const currentChainId = parseChainIdFromHex(currentChainHex);

    if (currentChainId === targetChainId) {
      setWalletChainId(currentChainId);
      return;
    }

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHexChainId(targetChainId) }]
      });
    } catch (error) {
      if (isRecord(error) && (error as EthereumRpcError).code === 4902) {
        throw new Error(`Wallet does not support chain ${targetChainId}. Please add this network first.`);
      }

      const message = getRpcErrorMessage(error);
      throw new Error(message || 'Failed to switch wallet network.');
    }

    const updatedChainHex = await provider.request({ method: 'eth_chainId' });
    const updatedChainId = parseChainIdFromHex(updatedChainHex);
    if (updatedChainId !== targetChainId) {
      throw new Error(`Wallet is on chain ${updatedChainId}, expected ${targetChainId}.`);
    }

    setWalletChainId(updatedChainId);
  };

  const loadVaults = async () => {
    setErrorMessage(null);
    setIsLoadingVaults(true);

    try {
      const parsedChain = parseInt(chainId, 10);
      if (!Number.isInteger(parsedChain) || parsedChain <= 0) {
        throw new Error('Chain ID must be a positive integer');
      }

      const response = await getEarnVaults({ chainId: parsedChain });
      setVaults(response.data);
      setVaultNextCursor(response.nextCursor ?? null);
      setVaultTotal(typeof response.total === 'number' ? response.total : null);
      setSelectedVault(null);
      setVaultDetail(null);
      clearPostVaultState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load vaults');
    } finally {
      setIsLoadingVaults(false);
    }
  };

  const loadMoreVaults = async () => {
    if (!vaultNextCursor) {
      return;
    }

    setErrorMessage(null);
    setIsLoadingMoreVaults(true);

    try {
      const parsedChain = parseInt(chainId, 10);
      if (!Number.isInteger(parsedChain) || parsedChain <= 0) {
        throw new Error('Chain ID must be a positive integer');
      }

      const response = await getEarnVaults({
        chainId: parsedChain,
        cursor: vaultNextCursor
      });

      setVaults((current) => mergeVaults(current, response.data));
      setVaultNextCursor(response.nextCursor ?? null);
      if (typeof response.total === 'number') {
        setVaultTotal(response.total);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load more vaults');
    } finally {
      setIsLoadingMoreVaults(false);
    }
  };

  const selectVault = async (vault: EarnVault) => {
    setErrorMessage(null);
    setIsLoadingDetail(true);
    setSelectedVault(vault);
    setVaultDetail(null);
    clearPostVaultState();

    try {
      // Earn detail endpoint expects numeric chainId in path.
      const detail = await getEarnVaultDetail(String(vault.chainId), vault.address);
      setVaultDetail(detail);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load vault detail');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const buildQuote = async (reviewConfirmed: boolean) => {
    setErrorMessage(null);
    setIsBuildingQuote(true);

    try {
      if (!detailedVault) {
        throw new Error('Select a vault first');
      }

      if (!isValidEvmAddress(walletAddress)) {
        throw new Error('Wallet address must be a valid EVM address');
      }

      const token = detailedVault.underlyingTokens?.[0];
      if (!token) {
        throw new Error('Selected vault has no underlying token data');
      }

      const fromAmount = toBaseUnits(depositAmount, token.decimals);
      const quote = await buildCompliantComposerQuote({
        fromChain: detailedVault.chainId,
        toChain: detailedVault.chainId,
        fromToken: token.address,
        toToken: detailedVault.address,
        fromAddress: walletAddress,
        toAddress: walletAddress,
        fromAmount,
        reviewConfirmed
      });

      setQuoteResponse(quote);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to build quote');
    } finally {
      setIsBuildingQuote(false);
    }
  };

  const executeQuotedTransaction = async () => {
    setErrorMessage(null);
    setTxStatus(null);
    setTxHash('');
    setTxExplorerUrl(null);
    setIsSendingTransaction(true);

    try {
      if (!quoteResponse?.quote || !isRecord(quoteResponse.quote)) {
        throw new Error('Build a Composer quote before sending transaction.');
      }

      if (!detailedVault) {
        throw new Error('Select a vault first.');
      }

      if (!isValidEvmAddress(walletAddress)) {
        throw new Error('Connect a valid wallet before sending transaction.');
      }

      const provider = getWalletProvider();
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== 'string') {
        throw new Error('Wallet is not connected. Please connect wallet first.');
      }

      const senderAddress = accounts[0];
      if (!isValidEvmAddress(senderAddress)) {
        throw new Error('Wallet returned an invalid account address.');
      }

      if (quoteResponse.aml.checkedAddress.toLowerCase() !== senderAddress.toLowerCase()) {
        throw new Error('Connected wallet does not match quote wallet. Rebuild quote after connecting wallet.');
      }

      setWalletAddress(senderAddress);
      await ensureWalletOnChain(provider, detailedVault.chainId);

      const transactionRequest = extractComposerTransactionRequest(quoteResponse.quote);
      if (!transactionRequest?.to || !isValidEvmAddress(transactionRequest.to)) {
        throw new Error('Composer quote did not return a valid transactionRequest.to address.');
      }

      const txPayload: Record<string, string> = {
        from: senderAddress,
        to: transactionRequest.to
      };

      if (typeof transactionRequest.data === 'string') {
        txPayload.data = transactionRequest.data;
      }

      const value = toRpcQuantity(transactionRequest.value);
      if (value) {
        txPayload.value = value;
      }

      const gas = toRpcQuantity(transactionRequest.gas || transactionRequest.gasLimit);
      if (gas) {
        txPayload.gas = gas;
      }

      const gasPrice = toRpcQuantity(transactionRequest.gasPrice);
      if (gasPrice) {
        txPayload.gasPrice = gasPrice;
      }

      const maxFeePerGas = toRpcQuantity(transactionRequest.maxFeePerGas);
      if (maxFeePerGas) {
        txPayload.maxFeePerGas = maxFeePerGas;
      }

      const maxPriorityFeePerGas = toRpcQuantity(transactionRequest.maxPriorityFeePerGas);
      if (maxPriorityFeePerGas) {
        txPayload.maxPriorityFeePerGas = maxPriorityFeePerGas;
      }

      const nonce = toRpcQuantity(transactionRequest.nonce);
      if (nonce) {
        txPayload.nonce = nonce;
      }

      const txHashResult = await provider.request({
        method: 'eth_sendTransaction',
        params: [txPayload]
      });

      if (typeof txHashResult !== 'string' || !isHexString(txHashResult)) {
        throw new Error('Wallet did not return a valid transaction hash.');
      }

      setTxHash(txHashResult);
      setTxStatus('PENDING');
      setTxExplorerUrl(toExplorerTxUrl(detailedVault.chainId, txHashResult));

      const receipt = await waitForTransactionReceipt(provider, txHashResult);
      if (receipt.status === '0x1') {
        setTxStatus('SUCCESS');
        return;
      }

      setTxStatus('FAILED');
      throw new Error('Transaction was mined but reverted.');
    } catch (error) {
      setTxStatus('FAILED');
      const message = getRpcErrorMessage(error);
      setErrorMessage(message || (error instanceof Error ? error.message : 'Failed to execute transaction'));
    } finally {
      setIsSendingTransaction(false);
    }
  };

  const loadPortfolio = async () => {
    setErrorMessage(null);
    setIsLoadingPortfolio(true);

    try {
      if (!isValidEvmAddress(walletAddress)) {
        throw new Error('Wallet address must be a valid EVM address');
      }

      const portfolio = await getEarnPortfolio(walletAddress);
      setPortfolioResponse(portfolio);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load portfolio');
    } finally {
      setIsLoadingPortfolio(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-6 px-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" stroke="#00D4AA" strokeWidth="2" fill="rgba(0, 212, 170, 0.1)" />
                <path d="M12 6L16.5 9V15L12 18L7.5 15V9L12 6Z" fill="#00D4AA" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">BridgeShield</h1>
              <p className="text-secondary text-xs">Earn + Composer Compliance Flow</p>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-secondary hover:text-white transition-colors">Check</Link>
            <Link to="/compare" className="text-secondary hover:text-white transition-colors">Compare</Link>
            <Link to="/earn-flow" className="text-primary font-medium">Earn Flow</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-10 px-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h2 className="text-4xl font-bold mb-3">Earn Data API + Composer with AML Gate</h2>
            <p className="text-secondary max-w-3xl mx-auto">
              End-to-end evidence flow: discover vaults from <span className="text-white">earn.li.fi</span>, run BridgeShield AML policy,
              build quote via <span className="text-white">li.quest</span>, and verify portfolio positions with C-end behavior analytics.
            </p>
          </motion.div>

          {errorMessage && (
            <div className="p-4 rounded-lg border border-danger/30 bg-danger/10 text-danger">
              {errorMessage}
            </div>
          )}

          <section className="p-6 rounded-xl border border-white/10 bg-card">
            <h3 className="text-xl font-semibold mb-4">1. Discover Vaults (Earn Data API)</h3>
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <input
                type="text"
                value={chainId}
                onChange={(event) => setChainId(event.target.value)}
                className="px-4 py-3 bg-black/20 border border-white/10 rounded-lg font-mono"
                placeholder="Chain ID (e.g. 8453)"
              />
              <button
                type="button"
                onClick={loadVaults}
                disabled={isLoadingVaults}
                className="px-6 py-3 bg-primary text-background font-semibold rounded-lg disabled:opacity-50"
              >
                {isLoadingVaults ? 'Loading...' : 'Load Vaults'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {vaults.map((vault) => (
                <button
                  key={getVaultKey(vault)}
                  type="button"
                  onClick={() => selectVault(vault)}
                  className={`text-left p-4 rounded-lg border transition-all ${
                    selectedVault?.address === vault.address
                      ? 'border-primary bg-primary/10'
                      : 'border-white/10 bg-black/20 hover:border-primary/30'
                  }`}
                >
                  <p className="font-semibold">{vault.name || vault.address}</p>
                  <p className="text-secondary text-sm">
                    {vault.protocol?.name || 'Unknown protocol'} • {vault.network || 'Unknown network'}
                  </p>
                  <p className="text-secondary text-xs mt-1">
                    APY {formatApy(vault.analytics?.apy?.total)} • TVL ${formatUsd(vault.analytics?.tvl?.usd)}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-secondary">
                Loaded vaults: {vaults.length}
                {typeof vaultTotal === 'number' ? ` / ${vaultTotal}` : ''}
              </p>
              {vaultNextCursor && (
                <button
                  type="button"
                  onClick={loadMoreVaults}
                  disabled={isLoadingMoreVaults}
                  className="px-4 py-2 bg-primary text-background font-semibold rounded-lg disabled:opacity-50"
                >
                  {isLoadingMoreVaults ? 'Loading more...' : 'Load More Vaults'}
                </button>
              )}
            </div>

            {!isLoadingVaults && vaults.length === 0 && (
              <p className="mt-3 text-secondary text-sm">No vaults returned for this chain yet.</p>
            )}
          </section>

          <section className="p-6 rounded-xl border border-white/10 bg-card">
            <h3 className="text-xl font-semibold mb-4">2. Vault Detail + Build AML-Gated Composer Quote</h3>
            {isLoadingDetail && <p className="text-secondary mb-3">Loading vault detail...</p>}

            {detailedVault ? (
              <>
                <div className="mb-5 p-4 rounded-lg border border-white/10 bg-black/20">
                  <p className="font-semibold">{detailedVault.name || detailedVault.address}</p>
                  <p className="text-secondary text-sm">
                    {detailedVault.protocol?.name || 'Unknown protocol'} • {detailedVault.network} • chainId {detailedVault.chainId}
                  </p>
                  <p className="text-secondary text-sm mt-1">
                    Underlying token: {detailedVault.underlyingTokens?.[0]?.symbol || 'N/A'} • transactional:{' '}
                    {detailedVault.isTransactional === false ? 'No' : 'Yes'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(event) => setWalletAddress(event.target.value)}
                    className="px-4 py-3 bg-black/20 border border-white/10 rounded-lg font-mono text-sm"
                    placeholder="Wallet address"
                  />
                  <input
                    type="text"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    className="px-4 py-3 bg-black/20 border border-white/10 rounded-lg"
                    placeholder="Deposit amount (e.g. 1)"
                  />
                </div>

                <div className="mb-4 p-4 rounded-lg border border-white/10 bg-black/20 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm">
                    <p>
                      Wallet state:{' '}
                      {isValidEvmAddress(walletAddress)
                        ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}`
                        : 'Not connected'}
                    </p>
                    <p className="text-secondary">Wallet chain: {walletChainId ?? 'Unknown'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={connectWallet}
                    disabled={isConnectingWallet}
                    className="px-5 py-2 bg-primary text-background font-semibold rounded-lg disabled:opacity-50"
                  >
                    {isConnectingWallet ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => buildQuote(false)}
                    disabled={isBuildingQuote}
                    className="px-6 py-3 bg-primary text-background font-semibold rounded-lg disabled:opacity-50"
                  >
                    {isBuildingQuote ? 'Building...' : 'Build Quote'}
                  </button>
                  {quoteResponse?.requiresReviewConfirmation && (
                    <button
                      type="button"
                      onClick={() => buildQuote(true)}
                      disabled={isBuildingQuote}
                      className="px-6 py-3 bg-warning text-background font-semibold rounded-lg disabled:opacity-50"
                    >
                      Confirm REVIEW and Continue
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-secondary">Select a vault first to continue.</p>
            )}

            {quoteResponse && (
              <div className="mt-6 space-y-4">
                <div className={`p-4 rounded-lg border ${
                  quoteResponse.aml.decision === 'BLOCK'
                    ? 'border-danger/30 bg-danger/10'
                    : quoteResponse.aml.decision === 'REVIEW'
                      ? 'border-warning/30 bg-warning/10'
                      : 'border-primary/30 bg-primary/10'
                }`}>
                  <p className="font-semibold">
                    AML Decision: {quoteResponse.aml.decision} ({quoteResponse.aml.riskLevel})
                  </p>
                  <p className="text-sm mt-1">
                    Risk score: {quoteResponse.aml.riskScore} • Checked address: {quoteResponse.aml.checkedAddress}
                  </p>
                  {quoteResponse.aml.behaviorEscalated && quoteResponse.aml.baseDecision && (
                    <p className="text-sm mt-1 text-warning">
                      Behavior escalation: {quoteResponse.aml.baseDecision} → {quoteResponse.aml.decision}
                    </p>
                  )}
                  {quoteResponse.aml.behavior && (
                    <div className="mt-2 text-sm">
                      <p>
                        Behavior score: {quoteResponse.aml.behavior.score}/100 • {quoteResponse.aml.behavior.level} • confidence {quoteResponse.aml.behavior.confidence}
                      </p>
                      {quoteResponse.aml.behavior.signals.length > 0 && (
                        <p className="text-secondary mt-1">
                          Signals: {quoteResponse.aml.behavior.signals.join(' | ')}
                        </p>
                      )}
                    </div>
                  )}
                  {quoteResponse.message && <p className="text-sm mt-1">{quoteResponse.message}</p>}
                </div>

                <CodeSnippet code={quoteCode} language="json" />

                <div className="p-4 rounded-lg border border-white/10 bg-black/20">
                  <p className="text-sm text-secondary mb-3">Execution evidence (real wallet transaction)</p>
                  <button
                    type="button"
                    onClick={executeQuotedTransaction}
                    disabled={!quoteResponse.quote || isSendingTransaction || !isValidEvmAddress(walletAddress)}
                    className="px-6 py-3 bg-primary text-background font-semibold rounded-lg disabled:opacity-50"
                  >
                    {isSendingTransaction ? 'Sending Transaction...' : 'Send Transaction with Wallet'}
                  </button>

                  <div className="mt-3 text-sm space-y-1">
                    <p>Tx status: {txStatus || 'Not started'}</p>
                    <p className="break-all">
                      Tx hash: {txHash || 'No transaction hash yet'}
                    </p>
                    {txExplorerUrl && (
                      <a
                        href={txExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        View on explorer
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="p-6 rounded-xl border border-white/10 bg-card">
            <h3 className="text-xl font-semibold mb-4">3. Verify Portfolio (Earn Data API)</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                type="button"
                onClick={loadPortfolio}
                disabled={isLoadingPortfolio}
                className="px-6 py-3 bg-primary text-background font-semibold rounded-lg disabled:opacity-50"
              >
                {isLoadingPortfolio ? 'Loading...' : 'Load Portfolio Positions'}
              </button>
            </div>

            <div className="p-4 rounded-lg border border-white/10 bg-black/20 text-sm">
              <p><span className="text-secondary">Vault source:</span> earn.li.fi</p>
              <p><span className="text-secondary">Composer source:</span> li.quest</p>
              <p><span className="text-secondary">Quote ready:</span> {quoteResponse?.quote ? 'Yes' : 'No'}</p>
              <p><span className="text-secondary">Tx hash provided:</span> {txHash ? txHash : 'Not provided yet'}</p>
              <p><span className="text-secondary">Portfolio positions loaded:</span> {portfolioResponse?.positions?.length ?? 0}</p>
            </div>

            {portfolioPreview.length > 0 && (
              <div className="mt-4 p-4 rounded-lg border border-white/10 bg-black/20">
                <p className="font-semibold mb-2">Portfolio preview</p>
                <ul className="list-disc list-inside text-secondary text-sm space-y-1">
                  {portfolioPreview.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default EarnFlowPage;
