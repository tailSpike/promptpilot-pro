import express from 'express';
import { authenticate } from '../middleware/auth';
import { IntegrationCredentialService } from '../services/integrationCredential.service';
import { IntegrationCredentialStatus } from '../generated/prisma/client';
import { listProviders } from '../config/providers';

const router = express.Router();

router.use(authenticate);

router.get('/providers', (_req, res) => {
  res.json({ providers: listProviders() });
});

router.get('/credentials', async (req, res, next) => {
  try {
    const credentials = await IntegrationCredentialService.list(req.user!.id);
    res.json({ credentials });
  } catch (error) {
    next(error);
  }
});

router.post('/credentials', async (req, res, next) => {
  try {
    const { provider, label, secret, metadata } = req.body ?? {};

    if (!provider || !label || !secret) {
      return res.status(400).json({ error: { message: 'provider, label and secret are required' } });
    }

    const credential = await IntegrationCredentialService.create({
      ownerId: req.user!.id,
      actorId: req.user!.id,
      provider,
      label,
      secret,
      metadata,
    });

    res.status(201).json({ credential });
  } catch (error) {
    next(error);
  }
});

router.patch('/credentials/:credentialId', async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    const { secret, metadata, label, status } = req.body ?? {};

    if (secret) {
      const credential = await IntegrationCredentialService.rotate({
        credentialId,
        ownerId: req.user!.id,
        actorId: req.user!.id,
        secret,
        metadata,
        label,
      });
      return res.json({ credential });
    }

    if (status === IntegrationCredentialStatus.REVOKED) {
      const credential = await IntegrationCredentialService.revoke({
        credentialId,
        ownerId: req.user!.id,
        actorId: req.user!.id,
      });
      return res.json({ credential });
    }

    const credential = await IntegrationCredentialService.updateMetadata({
      credentialId,
      ownerId: req.user!.id,
      actorId: req.user!.id,
      metadata,
      label,
    });

    res.json({ credential });
  } catch (error) {
    next(error);
  }
});

router.delete('/credentials/:credentialId', async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    const credential = await IntegrationCredentialService.revoke({
      credentialId,
      ownerId: req.user!.id,
      actorId: req.user!.id,
    });

    res.json({ credential });
  } catch (error) {
    next(error);
  }
});

router.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: { message: error.message } });
  }

  return res.status(500).json({ error: { message: 'Unexpected error' } });
});

export default router;
