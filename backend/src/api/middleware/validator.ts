import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  public errors: ValidationErrorItem[];
  
  constructor(errors: ValidationErrorItem[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export const validateAddress = (address: string): boolean => {
  if (!address) return false;
  
  const normalized = address.toLowerCase();
  
  if (!normalized.startsWith('0x')) return false;
  
  const hexPart = normalized.substring(2);
  if (hexPart.length !== 40) return false;
  
  return /^[0-9a-f]{40}$/.test(hexPart);
};

export const validateChainId = (chainId: number): boolean => {
  if (!Number.isInteger(chainId)) return false;
  return chainId > 0;
};

const getSingleQueryValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
};

export const validateRiskCheckInput = (req: Request): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];
  const { address, chainId } = req.body;
  
  if (!address) {
    errors.push({ field: 'address', message: 'Address is required' });
  } else if (!validateAddress(address)) {
    errors.push({ field: 'address', message: 'Invalid EVM address format (0x + 40 hex chars)' });
  }
  
  if (!chainId) {
    errors.push({ field: 'chainId', message: 'Chain ID is required' });
  } else if (!validateChainId(chainId)) {
    errors.push({ field: 'chainId', message: 'Chain ID must be a positive integer' });
  }
  
  if (req.body.amount !== undefined && typeof req.body.amount !== 'string') {
    errors.push({ field: 'amount', message: 'Amount must be a string' });
  }
  
  if (req.body.senderAddress !== undefined && !validateAddress(req.body.senderAddress)) {
    errors.push({ field: 'senderAddress', message: 'Invalid sender address format' });
  }
  
  return errors;
};

export const validateAppealInput = (req: Request): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];
  const { address, chainId, reason, contact } = req.body;
  
  if (!address) {
    errors.push({ field: 'address', message: 'Address is required' });
  } else if (!validateAddress(address)) {
    errors.push({ field: 'address', message: 'Invalid EVM address format' });
  }
  
  // chainId is optional, default to 1 in the route handler
  if (chainId !== undefined && !validateChainId(chainId)) {
    errors.push({ field: 'chainId', message: 'Chain ID must be a positive integer' });
  }
  
  if (!reason || reason.trim().length === 0) {
    errors.push({ field: 'reason', message: 'Appeal reason is required' });
  } else if (reason.length > 10000) {
    errors.push({ field: 'reason', message: 'Reason must be less than 10000 characters' });
  }
  
  if (contact && contact.length > 255) {
    errors.push({ field: 'contact', message: 'Contact info must be less than 255 characters' });
  }
  
  return errors;
};

export const validateEarnVaultDetailInput = (req: Request): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];
  const { network, address } = req.params;

  if (!network || network.trim().length === 0) {
    errors.push({ field: 'network', message: 'Network is required' });
  }

  if (!address) {
    errors.push({ field: 'address', message: 'Vault address is required' });
  } else if (!validateAddress(address)) {
    errors.push({ field: 'address', message: 'Invalid vault address format' });
  }

  return errors;
};

export const validateEarnPortfolioInput = (req: Request): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];
  const { wallet } = req.params;

  if (!wallet) {
    errors.push({ field: 'wallet', message: 'Wallet address is required' });
  } else if (!validateAddress(wallet)) {
    errors.push({ field: 'wallet', message: 'Invalid wallet address format' });
  }

  return errors;
};

export const validateComposerQuoteInput = (req: Request): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];

  const fromChain = getSingleQueryValue(req.query.fromChain);
  const toChain = getSingleQueryValue(req.query.toChain);
  const fromToken = getSingleQueryValue(req.query.fromToken);
  const toToken = getSingleQueryValue(req.query.toToken);
  const fromAddress = getSingleQueryValue(req.query.fromAddress);
  const toAddress = getSingleQueryValue(req.query.toAddress);
  const fromAmount = getSingleQueryValue(req.query.fromAmount);
  const reviewConfirmed = getSingleQueryValue(req.query.reviewConfirmed);

  if (!fromChain) {
    errors.push({ field: 'fromChain', message: 'fromChain is required' });
  } else if (!validateChainId(parseInt(fromChain, 10))) {
    errors.push({ field: 'fromChain', message: 'fromChain must be a positive integer' });
  }

  if (!toChain) {
    errors.push({ field: 'toChain', message: 'toChain is required' });
  } else if (!validateChainId(parseInt(toChain, 10))) {
    errors.push({ field: 'toChain', message: 'toChain must be a positive integer' });
  }

  if (!fromToken) {
    errors.push({ field: 'fromToken', message: 'fromToken is required' });
  } else if (!validateAddress(fromToken)) {
    errors.push({ field: 'fromToken', message: 'Invalid fromToken address format' });
  }

  if (!toToken) {
    errors.push({ field: 'toToken', message: 'toToken is required' });
  } else if (!validateAddress(toToken)) {
    errors.push({ field: 'toToken', message: 'Invalid toToken address format' });
  }

  if (!fromAddress) {
    errors.push({ field: 'fromAddress', message: 'fromAddress is required' });
  } else if (!validateAddress(fromAddress)) {
    errors.push({ field: 'fromAddress', message: 'Invalid fromAddress format' });
  }

  if (!toAddress) {
    errors.push({ field: 'toAddress', message: 'toAddress is required' });
  } else if (!validateAddress(toAddress)) {
    errors.push({ field: 'toAddress', message: 'Invalid toAddress format' });
  }

  if (!fromAmount) {
    errors.push({ field: 'fromAmount', message: 'fromAmount is required' });
  } else if (!/^\d+$/.test(fromAmount)) {
    errors.push({ field: 'fromAmount', message: 'fromAmount must be an integer string in smallest unit' });
  } else if (BigInt(fromAmount) <= 0n) {
    errors.push({ field: 'fromAmount', message: 'fromAmount must be greater than zero' });
  }

  if (reviewConfirmed && reviewConfirmed !== 'true' && reviewConfirmed !== 'false') {
    errors.push({ field: 'reviewConfirmed', message: 'reviewConfirmed must be "true" or "false"' });
  }

  return errors;
};

export const riskCheckValidator = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateRiskCheckInput(req);
  
  if (errors.length > 0) {
    logger.warn('Risk check validation failed', { errors, body: req.body });
    res.status(400).json({
      error: 'Validation failed',
      errors
    });
    return;
  }
  
  next();
};

export const appealValidator = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateAppealInput(req);
  
  if (errors.length > 0) {
    logger.warn('Appeal validation failed', { errors, body: req.body });
    res.status(400).json({
      error: 'Validation failed',
      errors
    });
    return;
  }
  
  next();
};

export const earnVaultDetailValidator = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateEarnVaultDetailInput(req);

  if (errors.length > 0) {
    logger.warn('Earn vault detail validation failed', { errors, params: req.params });
    res.status(400).json({
      error: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

export const earnPortfolioValidator = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateEarnPortfolioInput(req);

  if (errors.length > 0) {
    logger.warn('Earn portfolio validation failed', { errors, params: req.params });
    res.status(400).json({
      error: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

export const validateAnalyticsTransfersInput = (req: Request): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];
  
  const wallet = getSingleQueryValue(req.query.wallet);
  const fromChainStr = getSingleQueryValue(req.query.fromChain);
  const toChainStr = getSingleQueryValue(req.query.toChain);
  const fromTime = getSingleQueryValue(req.query.fromTime);
  const toTime = getSingleQueryValue(req.query.toTime);
  const limitStr = getSingleQueryValue(req.query.limit);

  if (!wallet) {
    errors.push({ field: 'wallet', message: 'Wallet address is required' });
  } else if (!validateAddress(wallet)) {
    errors.push({ field: 'wallet', message: 'Invalid wallet address format' });
  }

  if (fromChainStr) {
    const fromChain = parseInt(fromChainStr, 10);
    if (!validateChainId(fromChain)) {
      errors.push({ field: 'fromChain', message: 'fromChain must be a positive integer' });
    }
  }

  if (toChainStr) {
    const toChain = parseInt(toChainStr, 10);
    if (!validateChainId(toChain)) {
      errors.push({ field: 'toChain', message: 'toChain must be a positive integer' });
    }
  }

  if (fromTime) {
    const fromTimestamp = Date.parse(fromTime);
    if (isNaN(fromTimestamp)) {
      errors.push({ field: 'fromTime', message: 'fromTime must be a valid ISO 8601 timestamp' });
    }
  }

  if (toTime) {
    const toTimestamp = Date.parse(toTime);
    if (isNaN(toTimestamp)) {
      errors.push({ field: 'toTime', message: 'toTime must be a valid ISO 8601 timestamp' });
    }
  }

  if (limitStr) {
    const limit = parseInt(limitStr, 10);
    if (isNaN(limit) || limit <= 0) {
      errors.push({ field: 'limit', message: 'limit must be a positive integer' });
    } else if (limit > 100) {
      errors.push({ field: 'limit', message: 'limit cannot exceed 100' });
    }
  }

  return errors;
};

export const composerQuoteValidator = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateComposerQuoteInput(req);

  if (errors.length > 0) {
    logger.warn('Composer quote validation failed', { errors, query: req.query });
    res.status(400).json({
      error: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

export const analyticsTransfersValidator = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateAnalyticsTransfersInput(req);

  if (errors.length > 0) {
    logger.warn('Analytics transfers validation failed', { errors, query: req.query });
    res.status(400).json({
      error: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

export const handleValidationError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof ValidationError) {
    logger.warn('Validation error', { errors: error.errors });
    res.status(400).json({
      error: 'Validation failed',
      errors: error.errors
    });
    return;
  }
  
  next(error);
};
