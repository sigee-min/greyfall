type ObjectState = { rev: number; value: unknown };

export class ClientNetObjectStore {
  private state = new Map<string, ObjectState>();

  get(id: string) {
    return this.state.get(id) ?? null;
  }

  applyReplace(id: string, rev: number, value: unknown): boolean {
    const current = this.state.get(id);
    if (current && rev <= current.rev) return false; // stale
    this.state.set(id, { rev, value });
    return true;
  }

  applyPatch(id: string, rev: number, _ops: unknown[]): boolean {
    // For now treat patch as replace miss; return false to indicate we prefer replace
    const current = this.state.get(id);
    if (!current) return false;
    if (rev !== current.rev + 1) return false;
    // No-op: caller should fallback to request replace
    return false;
  }
}

