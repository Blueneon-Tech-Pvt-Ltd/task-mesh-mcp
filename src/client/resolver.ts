import { ApiClient } from './api-client.js';

interface CachedProject {
  id: string;
  key: string;
  name: string;
  workflowStatuses?: Array<{ id: string; name: string; category: string }>;
  members?: Array<{ user: { id: string; name: string; email: string } }>;
}

export class EntityResolver {
  private projectCache = new Map<string, CachedProject>();
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(private api: ApiClient) {}

  private isExpired(): boolean {
    return Date.now() > this.cacheExpiry;
  }

  async getProjects(): Promise<CachedProject[]> {
    if (this.projectCache.size === 0 || this.isExpired()) {
      try {
        const projects = await this.api.get<any[]>('/pms/projects');
        this.projectCache.clear();
        for (const p of projects) {
          const cached: CachedProject = {
            id: p.id,
            key: (p.key || '').toUpperCase(),
            name: p.name,
            workflowStatuses: p.workflowStatuses,
            members: p.members,
          };
          this.projectCache.set(p.id, cached);
          if (cached.key) {
            this.projectCache.set(cached.key, cached);
          }
        }
        this.cacheExpiry = Date.now() + this.CACHE_TTL;
      } catch {
        // Return whatever is in cache on failure
      }
    }
    return Array.from(new Set(this.projectCache.values()));
  }

  /**
   * Resolve a project ID or key (e.g. "ALPHA" or "c1a2...") to the actual Project UUID
   */
  async resolveProjectId(idOrKey: string): Promise<string> {
    if (!idOrKey) throw new Error('Project identifier is required');

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
    if (isUUID) return idOrKey;

    await this.getProjects();
    const found = this.projectCache.get(idOrKey.toUpperCase()) || this.projectCache.get(idOrKey);
    if (found) return found.id;

    // Try direct API fetch
    try {
      const project = await this.api.get<any>(`/pms/projects/${idOrKey}`);
      if (project?.id) return project.id;
    } catch {
      // ignore
    }

    return idOrKey;
  }

  /**
   * Resolve status name / category (e.g. "In Progress", "TODO", "DONE") to workflow status UUID
   */
  async resolveStatusId(projectId: string, statusNameOrId: string): Promise<string> {
    if (!statusNameOrId) return statusNameOrId;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(statusNameOrId);
    if (isUUID) return statusNameOrId;

    const resolvedProjId = await this.resolveProjectId(projectId);
    const project = await this.api.get<any>(`/pms/projects/${resolvedProjId}`);

    if (project?.workflowStatuses?.length > 0) {
      const target = statusNameOrId.trim().toLowerCase().replace(/[_\s-]+/g, '');
      const match = project.workflowStatuses.find((s: any) => {
        const sName = (s.name || '').toLowerCase().replace(/[_\s-]+/g, '');
        const sCat = (s.category || '').toLowerCase().replace(/[_\s-]+/g, '');
        return sName === target || sCat === target || s.id === statusNameOrId;
      });

      if (match) return match.id;

      // Fallback: match by prefix or default status
      const partialMatch = project.workflowStatuses.find((s: any) => {
        const sName = (s.name || '').toLowerCase();
        return sName.includes(statusNameOrId.toLowerCase());
      });
      if (partialMatch) return partialMatch.id;
    }

    return statusNameOrId;
  }

  /**
   * Resolve user name or email to user UUID within the project / org
   */
  async resolveUserId(projectId: string, userIdentifier: string): Promise<string> {
    if (!userIdentifier) return userIdentifier;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdentifier);
    if (isUUID) return userIdentifier;

    const resolvedProjId = await this.resolveProjectId(projectId);
    const project = await this.api.get<any>(`/pms/projects/${resolvedProjId}`);

    if (project?.members?.length > 0) {
      const target = userIdentifier.trim().toLowerCase();
      const match = project.members.find((m: any) => {
        const u = m.user;
        if (!u) return false;
        return (
          u.id === userIdentifier ||
          (u.email && u.email.toLowerCase() === target) ||
          (u.name && u.name.toLowerCase().includes(target))
        );
      });
      if (match?.user?.id) return match.user.id;
    }

    return userIdentifier;
  }
}
