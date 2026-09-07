/**
 * Audit Logger Utility
 * Records security audit logs for all state-changing operations.
 */
class AuditLogger {
  constructor() {
    this.logs = [];
  }

  log(action, resourceId, actor, extra = {}) {
    const entry = {
      audit: {
        action,
        resourceId,
        actor: actor || 'anonymous',
        timestamp: new Date().toISOString(),
        status: 'SUCCESS',
        ...extra,
      },
    };

    this.logs.push(entry);
    console.log(JSON.stringify(entry));
    return entry;
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const auditLogger = new AuditLogger();
