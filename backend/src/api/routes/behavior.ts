import { Router, Request, Response } from 'express';
import { BehaviorAnalyzerService } from '../../services/behavior-analyzer';
import { validateAddress } from '../middleware/validator';
import { logger } from '../middleware/logger';

const router = Router();
const behaviorAnalyzer = new BehaviorAnalyzerService();

router.get('/profile/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const normalizedWallet = wallet.toLowerCase();

    if (!validateAddress(normalizedWallet)) {
      res.status(400).json({
        error: 'Validation failed',
        errors: [{ field: 'wallet', message: 'Invalid wallet address format' }]
      });
      return;
    }

    const chainIdRaw = typeof req.query.chainId === 'string' ? req.query.chainId : '1';
    const chainId = parseInt(chainIdRaw, 10);
    if (!Number.isInteger(chainId) || chainId <= 0) {
      res.status(400).json({
        error: 'Validation failed',
        errors: [{ field: 'chainId', message: 'chainId must be a positive integer' }]
      });
      return;
    }

    const amount = typeof req.query.amount === 'string' ? req.query.amount : undefined;
    const profile = await behaviorAnalyzer.analyzeAddressBehavior({
      address: normalizedWallet,
      chainId,
      amount
    });

    res.json({
      address: normalizedWallet,
      chainId,
      behavior: profile
    });
  } catch (error) {
    logger.error('Failed to build behavior profile', {
      error,
      params: req.params,
      query: req.query
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to build behavior profile'
    });
  }
});

export default router;
