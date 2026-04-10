import { Router, Request, Response } from 'express';
import { PrismaService } from '../../db/prisma-client';
import { CacheService, CacheTier } from '../../services/cache-service';
import { logger } from '../middleware/logger';

const router = Router();
const prismaService = PrismaService.getInstance();
const cacheService = CacheService.getInstance();

const parseRiskFactors = (responseData: string | null): string[] => {
  if (!responseData) {
    return [];
  }

  try {
    const parsed = JSON.parse(responseData) as any;

    if (parsed.isWhitelisted) {
      return ['Whitelisted address'];
    }

    if (parsed.factors?.details && Array.isArray(parsed.factors.details)) {
      return parsed.factors.details;
    }

    if (Array.isArray(parsed.factors)) {
      return parsed.factors;
    }

    if (parsed.riskType && typeof parsed.riskType === 'string') {
      return [parsed.riskType];
    }

    if (parsed.fallback) {
      return [parsed.fallbackReason || 'Fallback response'];
    }
  } catch (error) {
    logger.warn('Failed to parse risk factors from check log', { error });
  }

  return [];
};

router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayChecks = await prismaService.getClient().checkLog.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const todayBlocks = await prismaService.getClient().checkLog.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        },
        decision: 'BLOCK'
      }
    });

    const yesterdayChecks = await prismaService.getClient().checkLog.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today
        }
      }
    });

    const yesterdayBlocks = await prismaService.getClient().checkLog.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today
        },
        decision: 'BLOCK'
      }
    });

    const totalTodayChecks = await prismaService.getClient().checkLog.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const cachedTodayChecks = await prismaService.getClient().checkLog.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        },
        cacheHit: true
      }
    });

    const cacheHitRate = totalTodayChecks > 0 ? Math.round((cachedTodayChecks / totalTodayChecks) * 100) : 0;

    const checksTrend = yesterdayChecks > 0 ? 
      Math.round(((todayChecks - yesterdayChecks) / yesterdayChecks) * 100) : 0;
    const blocksTrend = yesterdayBlocks > 0 ? 
      Math.round(((todayBlocks - yesterdayBlocks) / yesterdayBlocks) * 100) : 0;

    res.json({
      todayChecks,
      todayBlocks,
      cacheHitRate,
      avgResponseTime: 124,
      checksTrend,
      blocksTrend
    });

  } catch (error) {
    logger.error('Failed to get dashboard stats', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get dashboard statistics'
    });
  }
});

router.get('/dashboard/risk-trend', async (req: Request, res: Response) => {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const dateRange = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      dateRange.push(date);
    }
    dateRange.reverse();

    const trendData = await Promise.all(
      dateRange.map(async (date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const checks = await prismaService.getClient().checkLog.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd
            }
          }
        });

        const blocks = await prismaService.getClient().checkLog.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd
            },
            decision: 'BLOCK'
          }
        });

        const month = dayStart.toLocaleString('default', { month: 'short' });
        const day = dayStart.getDate();
        const formattedDate = `${month} ${day}`;

        return {
          date: formattedDate,
          blocks,
          checks
        };
      })
    );

    res.json(trendData);

  } catch (error) {
    logger.error('Failed to get risk trend', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get risk trend data'
    });
  }
});

router.get('/dashboard/risk-distribution', async (req: Request, res: Response) => {
  try {
    const riskLevels = await prismaService.getClient().checkLog.groupBy({
      by: ['riskLevel'],
      _count: true
    });

    const allChecks = await prismaService.getClient().checkLog.findMany({
      select: {
        responseData: true
      }
    });

    const sourceCounts: Record<string, number> = {
      SANCTION: 0,
      HACKER: 0,
      MIXER: 0,
      SCAM: 0
    };

    allChecks.forEach(check => {
      if (check.responseData) {
        try {
          const data = JSON.parse(check.responseData) as any;
          if (data.riskType && typeof data.riskType === 'string' && sourceCounts[data.riskType] !== undefined) {
            sourceCounts[data.riskType]++;
          }
        } catch (e) {
          // Parse errors for malformed JSON are expected for some entries
        }
      }
    });

    const levelData = [
      { name: 'LOW', value: riskLevels.find(r => r.riskLevel === 'LOW')?._count || 0, color: '#22C55E' },
      { name: 'MEDIUM', value: riskLevels.find(r => r.riskLevel === 'MEDIUM')?._count || 0, color: '#F59E0B' },
      { name: 'HIGH', value: riskLevels.find(r => r.riskLevel === 'HIGH')?._count || 0, color: '#EF4444' }
    ];

    const sourceData = [
      { name: 'SANCTION', value: sourceCounts.SANCTION, color: '#3B82F6' },
      { name: 'HACKER', value: sourceCounts.HACKER, color: '#8B5CF6' },
      { name: 'MIXER', value: sourceCounts.MIXER, color: '#EC4899' },
      { name: 'SCAM', value: sourceCounts.SCAM, color: '#F97316' }
    ];

    res.json({
      levels: levelData,
      sources: sourceData
    });

  } catch (error) {
    logger.error('Failed to get risk distribution', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get risk distribution data'
    });
  }
});

router.get('/appeals', async (req: Request, res: Response) => {
  try {
    const appeals = await prismaService.getClient().appeal.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(appeals.map((appeal) => ({
      id: appeal.id,
      ticketId: appeal.ticketId,
      address: appeal.address,
      chainId: appeal.chainId,
      reason: appeal.reason,
      contact: appeal.contact,
      status: appeal.status,
      reviewNote: appeal.notes,
      reviewedAt: appeal.reviewedAt?.toISOString() || null,
      createdAt: appeal.createdAt.toISOString()
    })));

  } catch (error) {
    logger.error('Failed to get appeals', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get appeals list'
    });
  }
});

router.post('/appeal/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const appeal = await prismaService.getClient().$transaction(async (tx) => {
      const existingAppeal = await tx.appeal.findUnique({
        where: { id }
      });

      if (!existingAppeal) {
        throw new Error('APPEAL_NOT_FOUND');
      }

      if (existingAppeal.status !== 'PENDING') {
        throw new Error('APPEAL_ALREADY_REVIEWED');
      }

      const normalizedAddress = existingAppeal.address.toLowerCase();
      const existingWhitelistEntry = await tx.whitelistEntry.findUnique({
        where: { address: normalizedAddress }
      });

      if (!existingWhitelistEntry) {
        await tx.whitelistEntry.create({
          data: {
            address: normalizedAddress,
            chainId: existingAppeal.chainId,
            category: 'APPEAL_APPROVED',
            description: `Permanent whitelist from approved appeal - Ticket: ${existingAppeal.ticketId}`
          }
        });
      } else if (
        existingWhitelistEntry.category === 'APPEAL_TEMPORARY' ||
        existingWhitelistEntry.category === 'APPEAL_APPROVED'
      ) {
        await tx.whitelistEntry.update({
          where: { id: existingWhitelistEntry.id },
          data: {
            chainId: existingAppeal.chainId,
            category: 'APPEAL_APPROVED',
            description: `Permanent whitelist from approved appeal - Ticket: ${existingAppeal.ticketId}`,
            expiresAt: null
          }
        });
      }

      return tx.appeal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: now,
          reviewer: 'admin',
          decision: 'APPROVED'
        }
      });
    });

    cacheService.set(
      appeal.address,
      appeal.chainId,
      {
        riskScore: 0,
        riskLevel: 'LOW',
        decision: 'ALLOW'
      },
      CacheTier.WHITELIST
    );

    res.json({ success: true });

  } catch (error) {
    if (error instanceof Error && error.message === 'APPEAL_NOT_FOUND') {
      res.status(404).json({
        error: 'Not found',
        message: 'Appeal not found'
      });
      return;
    }

    if (error instanceof Error && error.message === 'APPEAL_ALREADY_REVIEWED') {
      res.status(409).json({
        error: 'Conflict',
        message: 'Appeal has already been reviewed'
      });
      return;
    }

    logger.error('Failed to approve appeal', { error, appealId: req.params.id });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to approve appeal'
    });
  }
});

router.post('/appeal/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const now = new Date();

    const result = await prismaService.getClient().$transaction(async (tx) => {
      const existingAppeal = await tx.appeal.findUnique({
        where: { id }
      });

      if (!existingAppeal) {
        throw new Error('APPEAL_NOT_FOUND');
      }

      if (existingAppeal.status !== 'PENDING') {
        throw new Error('APPEAL_ALREADY_REVIEWED');
      }

      const normalizedAddress = existingAppeal.address.toLowerCase();
      const existingWhitelistEntry = await tx.whitelistEntry.findUnique({
        where: { address: normalizedAddress }
      });

      if (existingWhitelistEntry?.category === 'APPEAL_TEMPORARY') {
        await tx.whitelistEntry.delete({
          where: { id: existingWhitelistEntry.id }
        });
      }

      await tx.appeal.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedAt: now,
          reviewer: 'admin',
          decision: 'REJECTED',
          notes: notes || null
        }
      });

      return {
        address: normalizedAddress,
        chainId: existingAppeal.chainId,
        removedTemporaryWhitelist: existingWhitelistEntry?.category === 'APPEAL_TEMPORARY'
      };
    });

    if (result.removedTemporaryWhitelist) {
      cacheService.clear(result.address, result.chainId);
    }

    res.json({ success: true });

  } catch (error) {
    if (error instanceof Error && error.message === 'APPEAL_NOT_FOUND') {
      res.status(404).json({
        error: 'Not found',
        message: 'Appeal not found'
      });
      return;
    }

    if (error instanceof Error && error.message === 'APPEAL_ALREADY_REVIEWED') {
      res.status(409).json({
        error: 'Conflict',
        message: 'Appeal has already been reviewed'
      });
      return;
    }

    logger.error('Failed to reject appeal', { error, appealId: req.params.id });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reject appeal'
    });
  }
});

router.get('/whitelist', async (req: Request, res: Response) => {
  try {
    const dbEntries = await prismaService.getClient().whitelistEntry.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedEntries = dbEntries.map(entry => ({
      id: entry.id,
      address: entry.address,
      type: entry.category,
      label: entry.description || entry.category,
      chainId: entry.chainId,
      createdAt: entry.createdAt.toISOString(),
      expiresAt: entry.expiresAt?.toISOString() || null,
    }));

    res.json(formattedEntries);

  } catch (error) {
    logger.error('Failed to get whitelist', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get whitelist'
    });
  }
});

router.post('/whitelist', async (req: Request, res: Response) => {
  try {
    const { address, type, label, chainId = 1, description } = req.body;

    if (!address || !type) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Address and type are required'
      });
      return;
    }

    const entry = await prismaService.createWhitelistEntry({
      address: address.toLowerCase(),
      chainId,
      category: type,
      description: description || label || 'No description'
    });

    res.json({
      id: entry.id,
      address: entry.address,
      type: entry.category,
      label: entry.description,
      chainId: entry.chainId,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt
    });

  } catch (error) {
    logger.error('Failed to add to whitelist', { error, body: req.body });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add to whitelist'
    });
  }
});

router.delete('/whitelist/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prismaService.getClient().whitelistEntry.delete({
      where: { id }
    });

    res.json({ success: true });

  } catch (error) {
    logger.error('Failed to delete whitelist entry', { error, id: req.params.id });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete whitelist entry'
    });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const logs = await prismaService.getClient().checkLog.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    const formattedLogs = logs.map(log => {
      const riskFactors = parseRiskFactors(log.responseData);

      return {
        id: log.id,
        checkId: log.checkId,
        address: log.address,
        chainId: log.chainId,
        riskScore: log.riskScore,
        riskLevel: log.riskLevel,
        action: log.decision,
        riskFactors,
        processingTimeMs: 100,
        cached: log.cacheHit,
        fallback: log.fallbackUsed,
        createdAt: log.createdAt
      };
    });

    res.json(formattedLogs);

  } catch (error) {
    logger.error('Failed to get check logs', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get check logs'
    });
  }
});

export default router;
