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