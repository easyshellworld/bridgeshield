import { Router, Request, Response } from 'express';
import { RiskDataLoader } from '../../data/risk-data-loader';
import { logger } from '../middleware/logger';

const router = Router();
const riskDataLoader = RiskDataLoader.getInstance();

router.get('/', async (req: Request, res: Response) => {
  try {
    const stats = riskDataLoader.getStats();
    
    const categories = Object.entries(stats.whitelistCategories || {}).map(([category, count]) => ({
      category,
      count
    }));
    
    categories.sort((a, b) => b.count - a.count);
    
    const response = {
      total: stats.totalWhitelistAddresses,
      categories,
      lastSyncedAt: new Date().toISOString(),
      version: '0.0.0'
    };
    
    logger.debug('Whitelist summary retrieved', {
      total: response.total,
      categoryCount: categories.length
    });
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get whitelist summary', { error });
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve whitelist information'
    });
  }
});

router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const normalizedAddress = address.toLowerCase();
    
    const whitelistItem = riskDataLoader.getWhitelistItem(normalizedAddress);
    
    if (!whitelistItem) {
      res.status(404).json({
        error: 'Not found',
        message: 'Address not found in whitelist'
      });
      return;
    }
    
    logger.debug('Whitelist entry retrieved', { address: normalizedAddress });
    
    res.json({
      ...whitelistItem,
      isWhitelisted: true
    });
  } catch (error) {
    logger.error('Failed to get whitelist entry', { error, address: req.params.address });
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve whitelist entry'
    });
  }
});

export default router;