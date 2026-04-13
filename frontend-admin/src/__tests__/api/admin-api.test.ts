import { describe, it, expect } from 'vitest';
import { normalizeAppeal, normalizeWhitelistEntry, buildTransferQueryString } from '../../api/admin-api';

describe('normalizeAppeal', () => {
  it('should map fields correctly (id, ticketId, address, reason, status)', () => {
    const appeal = {
      id: 'appeal-123',
      ticketId: 'ticket-456',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      reason: 'Test reason',
      status: 'PENDING',
      contact: 'test@example.com',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = normalizeAppeal(appeal);
    expect(result.id).toBe('appeal-123');
    expect(result.ticketId).toBe('ticket-456');
    expect(result.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(result.reason).toBe('Test reason');
    expect(result.status).toBe('PENDING');
    expect(result.contact).toBe('test@example.com');
    expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
  });

  it('should use reviewNote from appeal.notes when reviewNote is missing', () => {
    const appeal = {
      id: 'appeal-123',
      ticketId: 'ticket-456',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      reason: 'Test reason',
      status: 'APPROVED',
      notes: 'This is a note from appeal.notes',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = normalizeAppeal(appeal);
    expect(result.reviewNote).toBe('This is a note from appeal.notes');
  });

  it('should use reviewNote directly when provided', () => {
    const appeal = {
      id: 'appeal-123',
      ticketId: 'ticket-456',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      reason: 'Test reason',
      status: 'REJECTED',
      reviewNote: 'This is a direct reviewNote',
      notes: 'This should not be used',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = normalizeAppeal(appeal);
    expect(result.reviewNote).toBe('This is a direct reviewNote');
  });

  it('should handle missing optional fields', () => {
    const appeal = {
      id: 'appeal-123',
      ticketId: 'ticket-456',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      reason: 'Test reason',
      status: 'PENDING',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = normalizeAppeal(appeal);
    expect(result.contact).toBeUndefined();
    expect(result.reviewNote).toBeUndefined();
    expect(result.reviewedAt).toBeUndefined();
  });

  it('should use reviewedAt when provided', () => {
    const appeal = {
      id: 'appeal-123',
      ticketId: 'ticket-456',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      reason: 'Test reason',
      status: 'APPROVED',
      reviewedAt: '2024-01-02T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = normalizeAppeal(appeal);
    expect(result.reviewedAt).toBe('2024-01-02T00:00:00Z');
  });
});

describe('normalizeWhitelistEntry', () => {
  it('should map all fields correctly', () => {
    const entry = {
      id: 'whitelist-123',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      type: 'MANUAL',
      label: 'Test Label',
      chainId: 1,
      expiresAt: '2025-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = normalizeWhitelistEntry(entry);
    expect(result.id).toBe('whitelist-123');
    expect(result.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(result.type).toBe('MANUAL');
    expect(result.label).toBe('Test Label');
    expect(result.chainId).toBe(1);
    expect(result.expiresAt).toBe('2025-01-01T00:00:00Z');
    expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
  });

  it('should handle missing expiresAt', () => {
    const entry = {
      id: 'whitelist-123',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      type: 'AUTOMATIC',
      label: 'Test Label',
      chainId: 56,
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = normalizeWhitelistEntry(entry);
    expect(result.expiresAt).toBeUndefined();
  });
});

describe('buildTransferQueryString', () => {
  it('should build basic query with wallet', () => {
    const result = buildTransferQueryString('0x1234567890abcdef1234567890abcdef12345678');
    expect(result).toBe('wallet=0x1234567890abcdef1234567890abcdef12345678');
  });

  it('should include optional params when provided', () => {
    const result = buildTransferQueryString('0x1234567890abcdef1234567890abcdef12345678', {
      status: 'completed',
      fromTime: '2024-01-01T00:00:00Z',
      toTime: '2024-01-31T23:59:59Z',
      cursor: 'cursor-123',
    });
    expect(result).toContain('wallet=0x1234567890abcdef1234567890abcdef12345678');
    expect(result).toContain('status=completed');
    expect(result).toContain('fromTime=2024-01-01T00%3A00%3A00Z');
    expect(result).toContain('toTime=2024-01-31T23%3A59%3A59Z');
    expect(result).toContain('cursor=cursor-123');
  });

  it('should handle limit as number', () => {
    const result = buildTransferQueryString('0x1234567890abcdef1234567890abcdef12345678', {
      limit: 50,
    });
    expect(result).toContain('limit=50');
  });
});
