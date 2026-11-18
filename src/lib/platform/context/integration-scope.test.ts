import { describe, expect, it } from 'vitest';

import { createProjectIntegrationScope, modelPortScopeHeaders } from './integration-scope';

const memory = { tenantId: 'tenant-signalforge' };
const knowledge = {
  spaces: ['https://knowledge.example/spaces/shared'],
  projectSpacesEnabled: true,
  projectSpaceBaseUrl: 'https://knowledge.example/spaces/signalforge/projects',
};

describe('project integration scope', () => {
  it('derives stable external scopes from the trusted project identity', () => {
    const environment = {
      NODE_ENV: 'production',
      SIGNALFORGE_MODELPORT_ORGANIZATION_ID: 'org_dave',
      SIGNALFORGE_MODELPORT_PROJECT_ID: 'prj_signalforge',
      SIGNALFORGE_MODELPORT_ENVIRONMENT_ID: 'env_prod',
    };
    const first = createProjectIntegrationScope({ projectId: 'project-a', memory, knowledge, environment });
    const replay = createProjectIntegrationScope({ projectId: 'project-a', memory, knowledge, environment });

    expect(first).toEqual(replay);
    expect(first.knowledge.requestedSpaceIds).toEqual([
      'https://knowledge.example/spaces/shared',
      'https://knowledge.example/spaces/signalforge/projects/project-a',
    ]);
    expect(first.scopeSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(modelPortScopeHeaders(first)).toMatchObject({
      'X-ModelPort-Organization-Id': 'org_dave',
      'X-ModelPort-Project-Id': 'prj_signalforge',
      'X-ModelPort-Environment-Id': 'env_prod',
    });
  });

  it('keeps workspace knowledge partitions distinct while sharing the consumer boundary', () => {
    const first = createProjectIntegrationScope({ projectId: 'project-a', memory, knowledge });
    const second = createProjectIntegrationScope({ projectId: 'project-b', memory, knowledge });

    expect(first.memory.tenantId).toBe(second.memory.tenantId);
    expect(first.modelPort).toEqual(second.modelPort);
    expect(first.knowledge.projectSpaceId).not.toBe(second.knowledge.projectSpaceId);
    expect(first.scopeSha256).not.toBe(second.scopeSha256);
  });

  it('rejects malformed trusted scope configuration', () => {
    expect(() => createProjectIntegrationScope({
      projectId: 'project-a',
      memory,
      knowledge,
      environment: { SIGNALFORGE_MODELPORT_PROJECT_ID: 'bad project' },
    })).toThrow('SIGNALFORGE_MODELPORT_PROJECT_ID');
  });
});
