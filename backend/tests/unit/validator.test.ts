import { describe, it, expect } from 'vitest';
import {
  validateAddress,
  validateChainId,
  validateRiskCheckInput,
  validateAppealInput,
  validateEarnVaultDetailInput,
  validateEarnPortfolioInput,
  validateComposerQuoteInput,
  ValidationErrorItem
} from '../../src/api/middleware/validator';
import { Request } from 'express';

describe('Validator', () => {
  describe('validateAddress', () => {
    it('should return true for valid EVM address', () => {
      expect(validateAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(validateAddress('0x098B716B8Aaf21512996dC57EB0615e2383E2f96')).toBe(true);
    });

    it('should handle case-insensitive addresses', () => {
      expect(validateAddress('0x098B716B8Aaf21512996dC57EB0615e2383E2f96')).toBe(true);
      expect(validateAddress('0x098b716b8aaf21512996dc57eb0615e2383e2f96')).toBe(true);
      expect(validateAddress('0X098B716B8AAF21512996DC57EB0615E2383E2F96')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(validateAddress('')).toBe(false);
      expect(validateAddress(null as any)).toBe(false);
      expect(validateAddress(undefined as any)).toBe(false);
      expect(validateAddress('0x123')).toBe(false);
      expect(validateAddress('0x1234567890abcdef1234567890abcdef123456789')).toBe(false);
      expect(validateAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
      expect(validateAddress('0xgggggggggggggggggggggggggggggggggggggggg')).toBe(false);
    });
  });

  describe('validateChainId', () => {
    it('should return true for valid chain IDs', () => {
      expect(validateChainId(1)).toBe(true);
      expect(validateChainId(56)).toBe(true);
      expect(validateChainId(137)).toBe(true);
      expect(validateChainId(42161)).toBe(true);
    });

    it('should return false for invalid chain IDs', () => {
      expect(validateChainId(0)).toBe(false);
      expect(validateChainId(-1)).toBe(false);
      expect(validateChainId(1.5)).toBe(false);
      expect(validateChainId(null as any)).toBe(false);
      expect(validateChainId(undefined as any)).toBe(false);
      expect(validateChainId('1' as any)).toBe(false);
      expect(validateChainId(NaN)).toBe(false);
    });
  });

  describe('validateRiskCheckInput', () => {
    const createMockRequest = (body: any): Request => ({
      body
    } as Request);

    it('should return empty array for valid input', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([]);
    });

    it('should validate with optional fields', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: '1000000',
        senderAddress: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96'
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([]);
    });

    it('should return error for missing address', () => {
      const req = createMockRequest({
        chainId: 1
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'address', message: 'Address is required' }
      ]);
    });

    it('should return error for missing chainId', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678'
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'chainId', message: 'Chain ID is required' }
      ]);
    });

    it('should return error for invalid address format', () => {
      const req = createMockRequest({
        address: 'invalid',
        chainId: 1
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'address', message: 'Invalid EVM address format (0x + 40 hex chars)' }
      ]);
    });

    it('should return error for invalid chainId (0 is falsy)', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 0
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'chainId', message: 'Chain ID is required' }
      ]);
    });

    it('should return error for negative chainId', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: -1
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'chainId', message: 'Chain ID must be a positive integer' }
      ]);
    });

    it('should return error for invalid amount type', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: 1000000 // Should be string
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'amount', message: 'Amount must be a string' }
      ]);
    });

    it('should return error for invalid senderAddress', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        senderAddress: 'invalid'
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'senderAddress', message: 'Invalid sender address format' }
      ]);
    });

    it('should return multiple errors for multiple issues', () => {
      const req = createMockRequest({
        address: 'invalid',
        chainId: -1
      });
      const errors = validateRiskCheckInput(req);
      expect(errors).toEqual([
        { field: 'address', message: 'Invalid EVM address format (0x + 40 hex chars)' },
        { field: 'chainId', message: 'Chain ID must be a positive integer' }
      ]);
    });
  });

  describe('validateAppealInput', () => {
    const createMockRequest = (body: any): Request => ({
      body
    } as Request);

    it('should return empty array for valid input', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        reason: 'This is a valid appeal reason'
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([]);
    });

    it('should validate with optional contact field', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        reason: 'Valid reason',
        contact: 'contact@example.com'
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([]);
    });

    it('should return error for missing address', () => {
      const req = createMockRequest({
        chainId: 1,
        reason: 'Some reason'
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([
        { field: 'address', message: 'Address is required' }
      ]);
    });

    it('should accept missing chainId (optional, defaults to 1)', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        reason: 'Some reason'
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([]);
    });

    it('should return error for missing reason', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        reason: ''
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([
        { field: 'reason', message: 'Appeal reason is required' }
      ]);
    });

    it('should return error for reason too long', () => {
      const longReason = 'a'.repeat(10001);
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        reason: longReason
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([
        { field: 'reason', message: 'Reason must be less than 10000 characters' }
      ]);
    });

    it('should return error for invalid address format', () => {
      const req = createMockRequest({
        address: 'invalid',
        chainId: 1,
        reason: 'Valid reason'
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([
        { field: 'address', message: 'Invalid EVM address format' }
      ]);
    });

    it('should return error for invalid chainId (0 is not positive)', () => {
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 0,
        reason: 'Valid reason'
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([
        { field: 'chainId', message: 'Chain ID must be a positive integer' }
      ]);
    });

    it('should return error for contact too long', () => {
      const longContact = 'a'.repeat(256);
      const req = createMockRequest({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        reason: 'Valid reason',
        contact: longContact
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([
        { field: 'contact', message: 'Contact info must be less than 255 characters' }
      ]);
    });

    it('should return multiple errors for multiple issues', () => {
      const req = createMockRequest({
        address: 'invalid',
        chainId: -1,
        reason: ''
      });
      const errors = validateAppealInput(req);
      expect(errors).toEqual([
        { field: 'address', message: 'Invalid EVM address format' },
        { field: 'chainId', message: 'Chain ID must be a positive integer' },
        { field: 'reason', message: 'Appeal reason is required' }
      ]);
    });
  });

  describe('validateEarnVaultDetailInput', () => {
    const createMockRequest = (params: any): Request => ({
      params
    } as Request);

    it('should return empty array for valid params', () => {
      const req = createMockRequest({
        network: 'base',
        address: '0x1234567890abcdef1234567890abcdef12345678'
      });

      const errors = validateEarnVaultDetailInput(req);
      expect(errors).toEqual([]);
    });

    it('should return errors for invalid params', () => {
      const req = createMockRequest({
        network: '',
        address: 'invalid'
      });

      const errors = validateEarnVaultDetailInput(req);
      expect(errors).toEqual([
        { field: 'network', message: 'Network is required' },
        { field: 'address', message: 'Invalid vault address format' }
      ]);
    });
  });

  describe('validateEarnPortfolioInput', () => {
    const createMockRequest = (params: any): Request => ({
      params
    } as Request);

    it('should return empty array for valid wallet', () => {
      const req = createMockRequest({
        wallet: '0x1234567890abcdef1234567890abcdef12345678'
      });

      const errors = validateEarnPortfolioInput(req);
      expect(errors).toEqual([]);
    });

    it('should return errors for invalid wallet', () => {
      const req = createMockRequest({
        wallet: 'bad-wallet'
      });

      const errors = validateEarnPortfolioInput(req);
      expect(errors).toEqual([
        { field: 'wallet', message: 'Invalid wallet address format' }
      ]);
    });
  });

  describe('validateComposerQuoteInput', () => {
    const createMockRequest = (query: any): Request => ({
      query
    } as Request);

    it('should return empty array for valid query', () => {
      const req = createMockRequest({
        fromChain: '8453',
        toChain: '8453',
        fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        toToken: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183',
        fromAddress: '0x1234567890abcdef1234567890abcdef12345678',
        toAddress: '0x1234567890abcdef1234567890abcdef12345678',
        fromAmount: '1000000'
      });

      const errors = validateComposerQuoteInput(req);
      expect(errors).toEqual([]);
    });

    it('should return error for missing required query fields', () => {
      const req = createMockRequest({
        fromChain: '8453'
      });

      const errors = validateComposerQuoteInput(req);
      expect(errors).toEqual([
        { field: 'toChain', message: 'toChain is required' },
        { field: 'fromToken', message: 'fromToken is required' },
        { field: 'toToken', message: 'toToken is required' },
        { field: 'fromAddress', message: 'fromAddress is required' },
        { field: 'toAddress', message: 'toAddress is required' },
        { field: 'fromAmount', message: 'fromAmount is required' }
      ]);
    });

    it('should return error for invalid query values', () => {
      const req = createMockRequest({
        fromChain: '0',
        toChain: '-1',
        fromToken: 'bad',
        toToken: 'bad',
        fromAddress: 'bad',
        toAddress: 'bad',
        fromAmount: '1.2',
        reviewConfirmed: 'yes'
      });

      const errors = validateComposerQuoteInput(req);
      expect(errors).toEqual([
        { field: 'fromChain', message: 'fromChain must be a positive integer' },
        { field: 'toChain', message: 'toChain must be a positive integer' },
        { field: 'fromToken', message: 'Invalid fromToken address format' },
        { field: 'toToken', message: 'Invalid toToken address format' },
        { field: 'fromAddress', message: 'Invalid fromAddress format' },
        { field: 'toAddress', message: 'Invalid toAddress format' },
        { field: 'fromAmount', message: 'fromAmount must be an integer string in smallest unit' },
        { field: 'reviewConfirmed', message: 'reviewConfirmed must be "true" or "false"' }
      ]);
    });
  });
});
