import fs from 'fs';
import path from 'path';
import { logger } from '../api/middleware/logger';

export type RiskType = 'SANCTION' | 'HACKER' | 'MIXER' | 'SCAM';

export interface RiskDataItem {
  address: string;
  name?: string;
  risk_type: RiskType;
  sanctioned_by?: string;
  notes?: string;
}

export interface WhitelistItem {
  address: string;
  name?: string;
  category: string;
  description?: string;
}

export class RiskDataLoader {
  private static instance: RiskDataLoader;
  
  private riskData: Map<string, RiskDataItem> = new Map();
  private whitelistData: Map<string, WhitelistItem> = new Map();
  
  private riskCounts: Record<RiskType, number> = {
    SANCTION: 0,
    HACKER: 0,
    MIXER: 0,
    SCAM: 0
  };
  
  private whitelistCounts: Record<string, number> = {};
  
  private dataLoaded = false;
  
  private constructor() {}
  
  public static getInstance(): RiskDataLoader {
    if (!RiskDataLoader.instance) {
      RiskDataLoader.instance = new RiskDataLoader();
    }
    return RiskDataLoader.instance;
  }
  
  public async initialize(): Promise<void> {
    if (this.dataLoaded) {
      logger.info('Risk data already loaded');
      return;
    }
    
    try {
      await this.loadRiskData();
      await this.loadWhitelist();
      this.dataLoaded = true;
      
      logger.info('Risk data loaded successfully', {
        totalRiskAddresses: this.riskData.size,
        riskCounts: this.riskCounts,
        totalWhitelistAddresses: this.whitelistData.size,
        whitelistCategories: this.whitelistCounts
      });
    } catch (error) {
      logger.error('Failed to load risk data', { error });
      throw error;
    }
  }
  
  private async loadRiskData(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      
      const ofacData = await this.loadJsonFile<RiskDataItem[]>(
        path.join(dataDir, 'ofac-crypto-addresses.json')
      );
      ofacData.forEach(item => {
        const normalizedAddress = item.address.toLowerCase();
        this.riskData.set(normalizedAddress, { ...item, risk_type: 'SANCTION' });
        this.riskCounts.SANCTION++;
      });
      
      const hackerData = await this.loadJsonFile<RiskDataItem[]>(
        path.join(dataDir, 'hacker-addresses.json')
      );
      hackerData.forEach(item => {
        const normalizedAddress = item.address.toLowerCase();
        this.riskData.set(normalizedAddress, { ...item, risk_type: 'HACKER' });
        this.riskCounts.HACKER++;
      });
      
      const mixerData = await this.loadJsonFile<RiskDataItem[]>(
        path.join(dataDir, 'mixer-addresses.json')
      );
      mixerData.forEach(item => {
        const normalizedAddress = item.address.toLowerCase();
        this.riskData.set(normalizedAddress, { ...item, risk_type: 'MIXER' });
        this.riskCounts.MIXER++;
      });
      
      const scamData = await this.loadJsonFile<RiskDataItem[]>(
        path.join(dataDir, 'scam-addresses.json')
      );
      scamData.forEach(item => {
        const normalizedAddress = item.address.toLowerCase();
        this.riskData.set(normalizedAddress, { ...item, risk_type: 'SCAM' });
        this.riskCounts.SCAM++;
      });
    } catch (error) {
      logger.error('Failed to load risk data files', { error });
      throw error;
    }
  }
  
  private async loadWhitelist(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      
      const whitelistData = await this.loadJsonFile<WhitelistItem[]>(
        path.join(dataDir, 'whitelist.json')
      );
      
      whitelistData.forEach(item => {
        const normalizedAddress = item.address.toLowerCase();
        this.whitelistData.set(normalizedAddress, item);
        
        const category = item.category;
        this.whitelistCounts[category] = (this.whitelistCounts[category] || 0) + 1;
      });
    } catch (error) {
      logger.error('Failed to load whitelist data', { error });
      throw error;
    }
  }
  
  private async loadJsonFile<T>(filePath: string): Promise<T> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(new Error(`Failed to read file ${filePath}: ${err.message}`));
          return;
        }
        
        try {
          const parsed = JSON.parse(data) as T;
          resolve(parsed);
        } catch (parseError) {
          reject(new Error(`Failed to parse JSON from ${filePath}: ${parseError}`));
        }
      });
    });
  }
  
  public lookup(address: string): RiskDataItem | null {
    const normalizedAddress = address.toLowerCase();
    return this.riskData.get(normalizedAddress) || null;
  }
  
  public isWhitelisted(address: string): boolean {
    const normalizedAddress = address.toLowerCase();
    return this.whitelistData.has(normalizedAddress);
  }
  
  public getWhitelistItem(address: string): WhitelistItem | null {
    const normalizedAddress = address.toLowerCase();
    return this.whitelistData.get(normalizedAddress) || null;
  }
  
  public getStats() {
    return {
      totalRiskAddresses: this.riskData.size,
      riskCounts: this.riskCounts,
      totalWhitelistAddresses: this.whitelistData.size,
      whitelistCategories: this.whitelistCounts,
      dataLoaded: this.dataLoaded
    };
  }
  
  public isInitialized(): boolean {
    return this.dataLoaded;
  }
}