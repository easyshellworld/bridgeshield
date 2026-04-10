import { Prisma } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { PrismaService } from '../../db/prisma-client';
import { CacheService, CacheTier } from '../../services/cache-service';
import { logger } from '../middleware/logger';
import { appealValidator } from '../middleware/validator';
import { appealRateLimiter } from '../middleware/rate-limiter';

const router = Router();
const prismaService = PrismaService.getInstance();
const cacheService = CacheService.getInstance();

router.post('/', appealRateLimiter, appealValidator, async (req: Request, res: Response) => {
  try {
    const { address, chainId = 1, reason, contact } = req.body;
    const normalizedAddress = address.toLowerCase();
    const prisma = prismaService.getClient();
    const now = new Date();
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const existingPendingAppeal = await prisma.appeal.findFirst({
      where: {
        address: normalizedAddress,
        chainId,
        status: 'PENDING'
      }
    });

    if (existingPendingAppeal) {
      res.status(409).json({
        error: 'Conflict',
        message: 'An appeal for this address is already pending'
      });
      return;
    }

    const existingWhitelistEntry = await prisma.whitelistEntry.findUnique({
      where: { address: normalizedAddress }
    });

    if (existingWhitelistEntry) {
      const isExpiredTemporaryEntry =
        existingWhitelistEntry.category === 'APPEAL_TEMPORARY' &&
        existingWhitelistEntry.expiresAt !== null &&
        existingWhitelistEntry.expiresAt <= now;

      if (isExpiredTemporaryEntry) {
        await prisma.whitelistEntry.delete({
          where: { id: existingWhitelistEntry.id }
        });
      } else {
        res.status(409).json({
          error: 'Conflict',
          message: 'This address is already whitelisted or under review'
        });
        return;
      }
    }
    
    const appealCount = await prisma.appeal.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-${month}-${day}T00:00:00.000Z`),
          lt: new Date(`${year}-${month}-${parseInt(day) + 1}T00:00:00.000Z`)
        }
      }
    });
    
    const ticketId = `APT-${year}${month}${day}-${String(appealCount + 1).padStart(3, '0')}`;
    
    const estimatedReviewAt = new Date();
    estimatedReviewAt.setDate(estimatedReviewAt.getDate() + 7);

    const temporaryExpiry = new Date();
    temporaryExpiry.setDate(temporaryExpiry.getDate() + 1);

    await prisma.$transaction(async (tx) => {
      await tx.appeal.create({
        data: {
          ticketId,
          address: normalizedAddress,
          chainId,
          reason: reason.trim(),
          contact: contact ? contact.trim() : undefined,
          status: 'PENDING',
          estimatedReviewAt
        }
      });

      await tx.whitelistEntry.create({
        data: {
          address: normalizedAddress,
          chainId,
          category: 'APPEAL_TEMPORARY',
          description: `Temporary whitelist during appeal review - Ticket: ${ticketId}`,
          expiresAt: temporaryExpiry
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'APPEAL_CREATED',
          entityType: 'APPEAL',
          entityId: ticketId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: JSON.stringify({
            address: normalizedAddress,
            chainId,
            ticketId
          })
        }
      });
    });
    
    cacheService.set(
      normalizedAddress,
      chainId,
      {
        riskScore: 0,
        riskLevel: 'LOW',
        decision: 'ALLOW'
      },
      CacheTier.WHITELIST
    );
    
    logger.info('Appeal created', {
      ticketId,
      address: normalizedAddress,
      chainId,
      estimatedReviewAt
    });
    
    res.status(201).json({
      ticketId,
      address: normalizedAddress,
      chainId,
      status: 'PENDING',
      estimatedReviewAt: estimatedReviewAt.toISOString(),
      message: 'Appeal submitted successfully. Address temporarily whitelisted for 24 hours.',
      nextSteps: [
        'Your appeal is under review',
        'You will receive an email update when a decision is made',
        'Your address is temporarily whitelisted during the review period'
      ]
    });
  } catch (error) {
    logger.error('Failed to create appeal', {
      error,
      body: req.body
    });
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({
        error: 'Conflict',
        message: 'This address is already whitelisted or under review'
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create appeal'
    });
  }
});

router.get('/status/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    
    const appeal = await prismaService.getClient().appeal.findUnique({
      where: { ticketId }
    });
    
    if (!appeal) {
      res.status(404).json({
        error: 'Not found',
        message: 'Appeal not found'
      });
      return;
    }
    
    const canViewDetails = true;
    
    const response: any = {
      ticketId: appeal.ticketId,
      status: appeal.status,
      createdAt: appeal.createdAt,
      estimatedReviewAt: appeal.estimatedReviewAt
    };
    
    if (canViewDetails) {
      response.address = appeal.address;
      response.chainId = appeal.chainId;
      response.reason = appeal.reason;
      response.contact = appeal.contact;
      response.reviewedAt = appeal.reviewedAt;
      response.reviewer = appeal.reviewer;
      response.decision = appeal.decision;
      response.notes = appeal.notes;
    }
    
    logger.debug('Appeal status retrieved', { ticketId, status: appeal.status });
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get appeal status', { error, ticketId: req.params.ticketId });
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve appeal status'
    });
  }
});

export default router;
