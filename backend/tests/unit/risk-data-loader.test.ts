import { describe, it, expect, beforeAll } from 'vitest';
import { RiskDataLoader, RiskDataItem, WhitelistItem, RiskType } from '../../src/data/risk-data-loader';

describe('RiskDataLoader', () => {
  let riskDataLoader: RiskDataLoader;

  beforeAll(async () => {
    riskDataLoader = RiskDataLoader.getInstance();
    await riskDataLoader.initialize();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RiskDataLoader.getInstance();
      const instance2 = RiskDataLoader.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(RiskDataLoader);
    });
  });

  describe('isInitialized', () => {
    it('should return true after initialization', () => {
      expect(riskDataLoader.isInitialized()).toBe(true);
    });
  });

  describe('lookup', () => {
    it('should return correct data for known HACKER address', () => {
      const address = '0x098B716B8Aaf21512996dC57EB0615e2383E2f96'; // Ronin hacker
      const result = riskDataLoader.lookup(address);
      
      expect(result).not.toBeNull();
      expect(result!.address.toLowerCase()).toBe(address.toLowerCase());
      expect(result!.risk_type).toBe('HACKER');
    });

    it('should return correct data for known MIXER address', () => {
      const address = '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b'; // Tornado Cash
      const result = riskDataLoader.lookup(address);
      
      expect(result).not.toBeNull();
      expect(result!.address.toLowerCase()).toBe(address.toLowerCase());
      expect(result!.risk_type).toBe('MIXER');
    });

    it('should return null for unknown address', () => {
      const address = '0x0000000000000000000000000000000000000000';
      const result = riskDataLoader.lookup(address);
      
      expect(result).toBeNull();
    });

    it('should handle address case insensitivity', () => {
      const lowercaseAddress = '0x098b716b8aaf21512996dc57eb0615e2383e2f96';
      const uppercaseAddress = '0x098B716B8AAF21512996DC57EB0615E2383E2F96';
      
      const result1 = riskDataLoader.lookup(lowercaseAddress);
      const result2 = riskDataLoader.lookup(uppercaseAddress);
      
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1!.address.toLowerCase()).toBe(result2!.address.toLowerCase());
      expect(result1!.risk_type).toBe(result2!.risk_type);
    });
  });

  describe('isWhitelisted', () => {
    it('should return true for known whitelist address', () => {
      // Test with known whitelist addresses from data files
      const whitelistAddresses = [
        '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3
        '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'  // Lido
      ];
      
      for (const address of whitelistAddresses) {
        const isWhitelisted = riskDataLoader.isWhitelisted(address);
        expect(isWhitelisted).toBe(true);
      }
    });

    it('should return false for unknown address', () => {
      const address = '0x0000000000000000000000000000000000000000';
      const isWhitelisted = riskDataLoader.isWhitelisted(address);
      
      expect(isWhitelisted).toBe(false);
    });

    it('should handle address case insensitivity', () => {
      const lowercaseAddress = '0x1f98431c8ad98523631ae4a59f267346ea31f984';
      const uppercaseAddress = '0x1F98431C8AD98523631AE4A59F267346EA31F984';
      
      const result1 = riskDataLoader.isWhitelisted(lowercaseAddress);
      const result2 = riskDataLoader.isWhitelisted(uppercaseAddress);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('getWhitelistItem', () => {
    it('should return whitelist item for known address', () => {
      const address = '0x1F98431c8aD98523631AE4a59f267346ea31F984'; // Uniswap V3
      const item = riskDataLoader.getWhitelistItem(address);
      
      expect(item).not.toBeNull();
      expect(item!.address.toLowerCase()).toBe(address.toLowerCase());
      expect(item!.category).toBeDefined();
    });

    it('should return null for unknown address', () => {
      const address = '0x0000000000000000000000000000000000000000';
      const item = riskDataLoader.getWhitelistItem(address);
      
      expect(item).toBeNull();
    });

    it('should handle address case insensitivity', () => {
      const lowercaseAddress = '0x1f98431c8ad98523631ae4a59f267346ea31f984';
      const uppercaseAddress = '0x1F98431C8AD98523631AE4A59F267346EA31F984';
      
      const item1 = riskDataLoader.getWhitelistItem(lowercaseAddress);
      const item2 = riskDataLoader.getWhitelistItem(uppercaseAddress);
      
      expect(item1).not.toBeNull();
      expect(item2).not.toBeNull();
      expect(item1!.address.toLowerCase()).toBe(item2!.address.toLowerCase());
    });
  });

  describe('getStats', () => {
    it('should return statistics with counts', () => {
      const stats = riskDataLoader.getStats();
      
      expect(stats.dataLoaded).toBe(true);
      expect(stats.totalRiskAddresses).toBeGreaterThan(0);
      expect(stats.totalWhitelistAddresses).toBeGreaterThan(0);
      
      expect(stats.riskCounts).toBeDefined();
      expect(stats.riskCounts.SANCTION).toBeGreaterThanOrEqual(0);
      expect(stats.riskCounts.HACKER).toBeGreaterThanOrEqual(0);
      expect(stats.riskCounts.MIXER).toBeGreaterThanOrEqual(0);
      expect(stats.riskCounts.SCAM).toBeGreaterThanOrEqual(0);
      
      expect(stats.whitelistCategories).toBeDefined();
      expect(Object.keys(stats.whitelistCategories).length).toBeGreaterThan(0);
    });

    it('should have consistent counts', () => {
      const stats = riskDataLoader.getStats();
      
      // Note: totalRiskAddresses might be less than sum of riskCounts if there are duplicates
      // across different risk categories (same address in multiple files)
      const totalRiskFromCounts = Object.values(stats.riskCounts).reduce((sum, count) => sum + count, 0);
      expect(totalRiskFromCounts).toBeGreaterThanOrEqual(stats.totalRiskAddresses);
      
      // Whitelist counts should match exactly
      const totalWhitelistFromCounts = Object.values(stats.whitelistCategories).reduce((sum, count) => sum + count, 0);
      expect(totalWhitelistFromCounts).toBe(stats.totalWhitelistAddresses);
    });
  });

  describe('data consistency', () => {
    it('should not have addresses in both risk and whitelist data', () => {
      // This is a sanity check - addresses shouldn't be in both sets
      // We'll check a few known addresses
      const testAddresses = [
        '0x098B716B8Aaf21512996dC57EB0615e2383E2f96', // HACKER
        '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b', // MIXER
        '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Whitelist
        '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'  // Whitelist
      ];
      
      for (const address of testAddresses) {
        const isRisk = riskDataLoader.lookup(address) !== null;
        const isWhitelisted = riskDataLoader.isWhitelisted(address);
        
        // Address should not be both risk and whitelisted
        expect(isRisk && isWhitelisted).toBe(false);
      }
    });
  });
});
