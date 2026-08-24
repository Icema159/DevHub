import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { app } from '../app.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { closeResourceRateLimitService } from '../config/resource-rate-limiter.js';
import { createTestRequestHeaders, createTestSession } from '../test/auth-session.js';

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => resolve());
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('POST /api/documents exposes stable owner quota denials without writing storage metadata', async () => {
  const suffix = randomUUID();
  const userId = `upload-quota-${suffix}`;
  const server = app.listen(0, '127.0.0.1');
  await listen(server);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/documents`;

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: 'test-only',
        emailVerifiedAt: new Date(),
      },
    });
    const session = await createTestSession(userId);
    await prisma.document.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        id: `upload-quota-document-${index}-${suffix}`,
        userId,
        name: `Document ${index}.pdf`,
        storageKey: `tests/upload-quota-${index}-${suffix}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1n,
        fileHash: `upload-quota-hash-${index}-${suffix}`,
        status: DocumentStatus.READY,
      })),
    });
    const body = new FormData();
    body.set('file', new Blob(['%PDF-quota-test'], { type: 'application/pdf' }), 'Quota.pdf');
    const response = await fetch(url, {
      method: 'POST',
      headers: createTestRequestHeaders(session.cookieHeader),
      body,
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'DOCUMENT_LIMIT_REACHED',
        message: "You've reached the document limit for this demo.",
      },
    });
    assert.equal(await prisma.document.count({ where: { userId } }), 25);
    assert.equal(await prisma.documentQuotaReservation.count({ where: { userId } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await closeServer(server);
    await closeResourceRateLimitService();
    await disconnectPrisma();
  }
});

test('POST /api/documents rejects excessive multipart fields before creating a document', async () => {
  const suffix = randomUUID();
  const userId = `upload-multipart-${suffix}`;
  const server = app.listen(0, '127.0.0.1');
  await listen(server);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/documents`;

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: 'test-only',
        emailVerifiedAt: new Date(),
      },
    });
    const session = await createTestSession(userId);
    const body = new FormData();
    body.set('unexpected', 'field-value');
    body.set('file', new Blob(['%PDF-multipart-test'], { type: 'application/pdf' }), 'Safe.pdf');
    const response = await fetch(url, {
      method: 'POST',
      headers: createTestRequestHeaders(session.cookieHeader),
      body,
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_MULTIPART_UPLOAD',
        message: 'Multipart upload is invalid',
      },
    });
    assert.equal(await prisma.document.count({ where: { userId } }), 0);
    assert.equal(await prisma.documentQuotaReservation.count({ where: { userId } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await closeServer(server);
    await closeResourceRateLimitService();
    await disconnectPrisma();
  }
});
