import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DATA_AGENT_GENERATION_QUEUE_RELATIVE_PATH } from '@/lib/data-agent/workspace-layout';
import { enqueueQuantGeneration, readQuantGenerationQueue } from '@/lib/quant/generation-queue';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  enqueuePiAgentGenerationJob,
  claimPiAgentGenerationJob,
  heartbeatPiAgentGenerationJob,
  finishPiAgentGenerationJob,
  reconcileExpiredPiAgentGenerationJobs,
} from './pi-agent-generation-dispatch-store';

const databaseUrl = process.env.PI_AGENT_TEST_DATABASE_URL?.trim();

describe.skipIf(!databaseUrl)('dispatch reliability on PostgreSQL', () => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const projectIds: string[] = [];

  async function request() {
    const projectId = `reliability-${randomUUID()}`;
    const requestId = randomUUID();
    await client.project.create({ data: { id: projectId, name: 'Dispatch reliability test' } });
    projectIds.push(projectId);
    await client.userRequest.create({
      data: { id: requestId, projectId, instruction: 'Run research', status: 'processing' },
    });
    return { projectId, requestId, instruction: 'Run research' };
  }

  afterAll(async () => {
    vi.unstubAllEnvs();
    await client.agentGenerationJob.deleteMany({ where: { projectId: { in: projectIds } } });
    await client.userRequest.deleteMany({ where: { projectId: { in: projectIds } } });
    await client.project.deleteMany({ where: { id: { in: projectIds } } });
    await client.$disconnect();
  });

  it('concurrent first enqueue returns one durable job and one outbox event', async () => {
    const input = await request();
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      enqueuePiAgentGenerationJob({ ...input, executionEnvelope: { symbol: '510300', version: 1 } })));
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(await client.agentGenerationJob.count({ where: { projectId: input.projectId } })).toBe(1);
    expect(await client.agentGenerationOutboxEvent.count({ where: { projectId: input.projectId } })).toBe(1);
    // JSON object key order does not alter the execution contract.
    await expect(enqueuePiAgentGenerationJob({ ...input,
      executionEnvelope: { version: 1, symbol: '510300' } })).resolves.toMatchObject({ id: results[0].id });
  });

  it('accepts and claims one job despite a failed workspace projection, then repairs it', async () => {
    const input = await request();
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'signalforge-dispatch-projection-'));
    const projection = path.join(projectPath, DATA_AGENT_GENERATION_QUEUE_RELATIVE_PATH);
    try {
      await fs.mkdir(projection, { recursive: true });
      await enqueueQuantGeneration({ ...input, projectPath });
      await enqueueQuantGeneration({ ...input, projectPath });
      expect(await client.agentGenerationJob.count({ where: { projectId: input.projectId } })).toBe(1);
      const claim = await claimPiAgentGenerationJob({ ...input, leaseOwner: 'worker-projection', leaseTtlMs: 120000 });
      expect(claim.attemptCount).toBe(1);
      await fs.rmdir(projection);
      await readQuantGenerationQueue(projectPath, input.projectId);
      expect(JSON.parse(await fs.readFile(projection, 'utf8')).items)
        .toEqual([expect.objectContaining({ requestId: input.requestId, status: 'running' })]);
    } finally {
      await fs.rm(projectPath, { recursive: true, force: true });
    }
  });

  it('same request ID rejects changed data/model/retry contracts without partial writes', async () => {
    const input = await request();
    const original = { ...input, selectedModel: 'model-a', maxAttempts: 2,
      executionEnvelope: { symbol: '510300', start: '2025-01-01' } };
    const job = await enqueuePiAgentGenerationJob(original);
    for (const change of [
      { executionEnvelope: { symbol: '600519', start: '2025-01-01' } },
      { selectedModel: 'model-b' }, { maxAttempts: 3 }, { cliPreference: 'pi' },
    ]) {
      await expect(enqueuePiAgentGenerationJob({ ...original, ...change }))
        .rejects.toMatchObject({ code: 'GENERATION_DISPATCH_IDEMPOTENCY_CONFLICT' });
    }
    expect(await client.agentGenerationOutboxEvent.count({ where: { jobId: job.id } })).toBe(1);
    expect(await client.agentGenerationJob.findUnique({ where: { id: job.id } }))
      .toMatchObject({ selectedModel: 'model-a', maxAttempts: 2, status: 'pending' });
  });

  it('recovers a lost worker and rejects its late heartbeat and completion', async () => {
    vi.stubEnv('PI_AGENT_DISPATCH_MODE', 'worker');
    vi.stubEnv('PI_AGENT_DISPATCH_RETRY_BASE_DELAY_MS', '100');
    try {
      const input = await request();
      const job = await enqueuePiAgentGenerationJob({ ...input, maxAttempts: 3 });
      const oldClaim = await claimPiAgentGenerationJob({ ...input, leaseOwner: 'worker-old', leaseTtlMs: 120000 });
      await client.agentGenerationJob.update({ where: { id: job.id }, data: { leaseExpiresAt: new Date(0) } });
      await expect(reconcileExpiredPiAgentGenerationJobs({ projectId: input.projectId }))
        .resolves.toEqual([expect.objectContaining({ status: 'retry_wait' })]);
      await client.agentGenerationJob.update({ where: { id: job.id }, data: { availableAt: new Date(0) } });
      const newClaim = await claimPiAgentGenerationJob({ ...input, leaseOwner: 'worker-new', leaseTtlMs: 120000 });
      expect(newClaim.fencingToken).toBeGreaterThan(oldClaim.fencingToken);
      expect(newClaim.attemptCount).toBe(2);
      await expect(heartbeatPiAgentGenerationJob({ fence: oldClaim, leaseTtlMs: 120000 })).rejects.toThrow();
      await expect(finishPiAgentGenerationJob({ ...input, status: 'completed', fence: oldClaim })).rejects.toThrow();
      await expect(finishPiAgentGenerationJob({ ...input, status: 'completed', fence: newClaim }))
        .resolves.toMatchObject({ status: 'completed', attemptCount: 2 });
      const events = await client.agentGenerationOutboxEvent.findMany({
        where: { jobId: job.id }, orderBy: { sequence: 'asc' },
      });
      expect(events.map(event => event.sequence)).toEqual([1, 2, 3, 4, 5]);
      expect(events.map(event => event.eventType)).toEqual([
        'generation_queued', 'generation_claimed', 'generation_retry_scheduled',
        'generation_claimed', 'generation_completed',
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
