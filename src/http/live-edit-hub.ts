export interface LiveEditEntry {
  key: string;
  actor: string;
  label: string;
  startedAt: string;
  updatedAt: string;
  expiresAtMs: number;
}

export interface LiveEditView {
  key: string;
  actor: string;
  label: string;
  startedAt: string;
  updatedAt: string;
  mine: boolean;
}

const LIVE_EDIT_TTL_MS = Number(process.env.LIVE_EDIT_TTL_MS ?? 15_000);
const liveEditRegistry = new Map<string, LiveEditEntry>();
const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const nowMs = () => Date.now();
const nowIso = () => new Date().toISOString();

const cleanupLiveEditsInternal = (): boolean => {
  const current = nowMs();
  let changed = false;

  for (const [key, entry] of liveEditRegistry.entries()) {
    if (entry.expiresAtMs <= current) {
      liveEditRegistry.delete(key);
      changed = true;
    }
  }

  return changed;
};

const toView = (entry: LiveEditEntry, actorId: string): LiveEditView => ({
  key: entry.key,
  actor: entry.actor,
  label: entry.label,
  startedAt: entry.startedAt,
  updatedAt: entry.updatedAt,
  mine: entry.actor === actorId
});

export const subscribeLiveEditEvents = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const sweepExpiredLiveEdits = (): boolean => {
  const changed = cleanupLiveEditsInternal();
  if (changed) {
    emitChange();
  }
  return changed;
};

export const listLiveEdits = (actorId: string): LiveEditView[] => {
  cleanupLiveEditsInternal();
  return [...liveEditRegistry.values()].map((entry) => toView(entry, actorId));
};

export const upsertLiveEdit = (key: string, actorId: string, label?: string): { conflict: boolean } => {
  const changedByCleanup = cleanupLiveEditsInternal();
  const now = nowIso();
  const existing = liveEditRegistry.get(key);

  if (existing && existing.actor !== actorId) {
    liveEditRegistry.set(key, {
      ...existing,
      updatedAt: now,
      expiresAtMs: nowMs() + LIVE_EDIT_TTL_MS
    });

    if (changedByCleanup) {
      emitChange();
    }

    return { conflict: true };
  }

  liveEditRegistry.set(key, {
    key,
    actor: actorId,
    label: label || key,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    expiresAtMs: nowMs() + LIVE_EDIT_TTL_MS
  });

  emitChange();
  return { conflict: false };
};

export const removeLiveEdit = (key: string, actorId: string): boolean => {
  const changedByCleanup = cleanupLiveEditsInternal();
  const existing = liveEditRegistry.get(key);

  if (!existing || existing.actor !== actorId) {
    if (changedByCleanup) {
      emitChange();
    }
    return false;
  }

  liveEditRegistry.delete(key);
  emitChange();
  return true;
};
