/** A request in the admin's approval queue: the account it belongs to and when it was made. */
export type QueueEntry = { accountId: string; createdAt: Date };

export type QueueGroup<Entry extends QueueEntry> = { accountId: string; entries: Entry[] };

/**
 * The queue per investor account: each group's requests newest first, and the groups ordered by their newest request,
 * so the account with the latest request comes first.
 */
export function groupByAccount<Entry extends QueueEntry>(entries: readonly Entry[]): QueueGroup<Entry>[] {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries.toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())) {
    groups.set(entry.accountId, [...(groups.get(entry.accountId) ?? []), entry]);
  }
  return [...groups].map(([accountId, groupEntries]) => ({ accountId, entries: groupEntries }));
}
