import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireAdminAuth } from '../middleware/auth';
import { logger } from '../middleware/logger';
import {
  authenticateAdminCredentials,
  createAdminAccessToken,
  ensureInitialAdminUser,
} from '../../services/auth-service';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body ?? {};

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.trim().length === 0 ||
      password.length === 0
    ) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Username and password are required',
      });
      return;
    }

    await ensureInitialAdminUser();

    const admin = await authenticateAdminCredentials(username, password);
    if (!admin) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
      return;
    }

    const token = createAdminAccessToken(admin);
    res.json({
      accessToken: token.accessToken,
      tokenType: 'Bearer',
      expiresIn: token.expiresIn,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    logger.error('Admin login failed', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Login failed',
    });
  }
});

router.get('/me', requireAdminAuth, (req: Request, res: Response) => {
  if (!req.auth?.admin) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin authentication required',
    });
    return;
  }

  res.json({
    id: req.auth.admin.userId,
    username: req.auth.admin.username,
    role: req.auth.admin.role,
    authMethod: req.auth.admin.authMethod,
  });
});

export default router;
