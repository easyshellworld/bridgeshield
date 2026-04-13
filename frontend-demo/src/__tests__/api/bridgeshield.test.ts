import { describe, it, expect } from 'vitest';
import {
  transformCheckResult,
  buildQueryString,
  readErrorMessage,
  isRecord
} from '../../api/bridgeshield';

describe('buildQueryString', () => {
  it('should build query string from params object', () => {
    const params = { chainId: 1, cursor: 'abc123', status: 'ALL' };
    const result = buildQueryString(params);
    expect(result).toBe('chainId=1&cursor=abc123&status=ALL');
  });

  it('should omit undefined values', () => {
    const params = { chainId: 1, cursor: undefined, status: 'ALL' };
    const result = buildQueryString(params);
    expect(result).toBe('chainId=1&status=ALL');
  });

  it('should handle empty params', () => {
    const params = {};
    const result = buildQueryString(params);
    expect(result).toBe('');
  });

  it('should handle boolean and number values', () => {
    const params = { active: true, count: 42, enabled: false };
    const result = buildQueryString(params);
    expect(result).toBe('active=true&count=42&enabled=false');
  });
});

describe('isRecord', () => {
  it('should return true for valid objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: 'value' })).toBe(true);
    expect(isRecord({ nested: { key: 'value' } })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isRecord('string')).toBe(false);
    expect(isRecord(123)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(Symbol('test'))).toBe(false);
  });
});

describe('readErrorMessage', () => {
  it('should extract message from payload.message', () => {
    const payload = { message: 'Custom error message' };
    const result = readErrorMessage(payload, 'Fallback message');
    expect(result).toBe('Custom error message');
  });

  it('should extract error from payload.error', () => {
    const payload = { error: 'Error field message' };
    const result = readErrorMessage(payload, 'Fallback message');
    expect(result).toBe('Error field message');
  });

  it('should return fallback for invalid payload', () => {
    expect(readErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(readErrorMessage(undefined, 'Fallback')).toBe('Fallback');
    expect(readErrorMessage('string', 'Fallback')).toBe('Fallback');
    expect(readErrorMessage(123, 'Fallback')).toBe('Fallback');
    expect(readErrorMessage([], 'Fallback')).toBe('Fallback');
    expect(readErrorMessage({}, 'Fallback')).toBe('Fallback');
  });

  it('should prioritize message over error', () => {
    const payload = { message: 'Message first', error: 'Error second' };
    const result = readErrorMessage(payload, 'Fallback');
    expect(result).toBe('Message first');
  });
});

describe('transformCheckResult', () => {
  it('should transform whitelisted address correctly', () => {
    const backendResponse = {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isWhitelisted: true,
      riskScore: 0,
      riskLevel: 'LOW',
      decision: 'ALLOW'
    };
    const result = transformCheckResult(backendResponse);
    expect(result.address).toBe(backendResponse.address);
    expect(result.riskFactors).toEqual(['Whitelisted address']);
    expect(result.recommendation).toBe('Transaction appears safe. Low risk detected.');
  });

  it('should transform address with risk factors correctly', () => {
    const backendResponse = {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      riskScore: 75,
      riskLevel: 'HIGH',
      decision: 'BLOCK',
      riskType: 'Sanctioned',
      factors: {
        details: ['Sanctioned address', 'High risk activity']
      }
    };
    const result = transformCheckResult(backendResponse);
    expect(result.address).toBe(backendResponse.address);
    expect(result.riskFactors).toEqual(['Sanctioned address', 'High risk activity']);
    expect(result.recommendation).toBe('Block this transaction. Risk type: Sanctioned. Do not proceed.');
  });

  it('should handle fallback response', () => {
    const backendResponse = {
      address: '0xfallback1234567890abcdef1234567890abcdef',
      fallback: true,
      fallbackReason: 'Service unavailable'
    };
    const result = transformCheckResult(backendResponse);
    expect(result.address).toBe(backendResponse.address);
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe('Service unavailable');
    expect(result.riskFactors).toEqual(['No risk factors']);
  });

  it('should extract recommendation based on decision', () => {
    const blockResponse = { decision: 'BLOCK', riskType: 'Scam' };
    const blockResult = transformCheckResult(blockResponse);
    expect(blockResult.recommendation).toBe('Block this transaction. Risk type: Scam. Do not proceed.');

    const reviewResponse = { decision: 'REVIEW' };
    const reviewResult = transformCheckResult(reviewResponse);
    expect(reviewResult.recommendation).toBe('Review this transaction manually before proceeding.');

    const allowResponse = { decision: 'ALLOW' };
    const allowResult = transformCheckResult(allowResponse);
    expect(allowResult.recommendation).toBe('Transaction appears safe. Low risk detected.');
  });

  it('should handle behaviorEscalated for REVIEW decision', () => {
    const backendResponse = {
      decision: 'REVIEW',
      behaviorEscalated: true,
      behavior: {
        recommendation: 'Custom behavior recommendation'
      }
    };
    const result = transformCheckResult(backendResponse);
    expect(result.recommendation).toBe('Custom behavior recommendation');
  });

  it('should use riskType if factors.details not available', () => {
    const backendResponse = {
      riskType: 'Phishing'
    };
    const result = transformCheckResult(backendResponse);
    expect(result.riskFactors).toEqual(['Risk type: Phishing']);
  });

  it('should set default values for missing fields', () => {
    const backendResponse = {
      address: '0x1234'
    };
    const result = transformCheckResult(backendResponse);
    expect(result.riskScore).toBe(0);
    expect(result.riskLevel).toBe('LOW');
    expect(result.action).toBe('ALLOW');
    expect(result.cached).toBe(false);
    expect(result.processingTimeMs).toBe(0);
    expect(result.fallback).toBe(false);
    expect(result.behaviorEscalated).toBe(false);
  });
});
