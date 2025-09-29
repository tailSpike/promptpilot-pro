import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import prisma from '../../lib/prisma';
import authRoutes from '../../routes/auth';
import libraryShareRoutes from '../../routes/libraryShares';
import featureFlagRoutes from '../../routes/featureFlags';
import usersRoutes from '../../routes/users';

describe('Library Sharing API', () => {
  let app: express.Express;
  let ownerToken: string;
  let inviteeToken: string;
  let ownerId: string;
  let inviteeId: string;
  let folderId: string;
  let promptId: string;

  beforeAll(async () => {
    process.env.FEATURE_FLAG_COLLABORATION_SHARING = 'true';

    app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/auth', authRoutes);
    app.use('/api/libraries', libraryShareRoutes);
    app.use('/api/feature-flags', featureFlagRoutes);
    app.use('/api/users', usersRoutes);

    const ownerRegister = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Share Owner',
        email: 'integration-owner@example.com',
        password: 'password123',
      });

    ownerToken = ownerRegister.body.token;
    ownerId = ownerRegister.body.user.id;

    const inviteeRegister = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Share Invitee',
        email: 'integration-invitee@example.com',
        password: 'password123',
      });

    inviteeToken = inviteeRegister.body.token;
    inviteeId = inviteeRegister.body.user.id;

    const folder = await prisma.folder.create({
      data: {
        name: 'Integration Library',
        userId: ownerId,
      },
    });
    folderId = folder.id;

    const prompt = await prisma.prompt.create({
      data: {
        name: 'Shared Prompt',
        content: 'Shared content',
        variables: [],
        metadata: {},
        userId: ownerId,
        folderId,
      },
    });
    promptId = prompt.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: ownerId } });
    await prisma.prompt.deleteMany({ where: { id: promptId } });
    await prisma.promptLibraryShare.deleteMany({ where: { folderId } });
    await prisma.folder.delete({ where: { id: folderId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.user.delete({ where: { id: inviteeId } });
  });

  afterEach(async () => {
    await prisma.promptLibraryShare.deleteMany({ where: { folderId } });
  });

  it('allows owner to share a library and lists shares', async () => {
    const shareResponse = await request(app)
      .post(`/api/libraries/${folderId}/shares`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ inviteeEmail: 'integration-invitee@example.com' })
      .expect(201);

    expect(shareResponse.body.share.folder.id).toBe(folderId);
    expect(shareResponse.body.share.invitedUser.email).toBe('integration-invitee@example.com');

    const listResponse = await request(app)
      .get(`/api/libraries/${folderId}/shares`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(listResponse.body.shares).toHaveLength(1);
    expect(listResponse.body.shares[0].invitedUser.email).toBe('integration-invitee@example.com');
  });

  it('exposes shared libraries to invitees', async () => {
    const shareResponse = await request(app)
      .post(`/api/libraries/${folderId}/shares`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ inviteeEmail: 'integration-invitee@example.com' })
      .expect(201);

    const shareId = shareResponse.body.share.id;

    const sharedWithMe = await request(app)
      .get('/api/libraries/shared-with-me')
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(200);

    expect(sharedWithMe.body.shares).toHaveLength(1);
    expect(sharedWithMe.body.shares[0].folder.id).toBe(folderId);

    const promptsResponse = await request(app)
      .get(`/api/libraries/${folderId}/prompts`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(200);

    expect(promptsResponse.body.prompts).toHaveLength(1);
    expect(promptsResponse.body.prompts[0].id).toBe(promptId);

    await request(app)
      .delete(`/api/libraries/${folderId}/shares/${shareId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const afterRevoke = await request(app)
      .get('/api/libraries/shared-with-me')
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(200);

    expect(afterRevoke.body.shares).toHaveLength(0);
  });

  it('blocks requests when feature flag disabled', async () => {
    process.env.FEATURE_FLAG_COLLABORATION_SHARING = 'false';

    await request(app)
      .post(`/api/libraries/${folderId}/shares`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ inviteeEmail: 'integration-invitee@example.com' })
      .expect(403);

    process.env.FEATURE_FLAG_COLLABORATION_SHARING = 'true';
  });

  it('supports member search API for share modal', async () => {
    const response = await request(app)
      .get('/api/users/search?q=integration-')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const emails = response.body.users.map((user: { email: string }) => user.email);
    expect(emails).toEqual(expect.arrayContaining(['integration-invitee@example.com']));
  });
});
