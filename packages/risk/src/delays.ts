// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.

export const microtaskDelay = (): Promise<void> => Promise.resolve();

export function scheduleDelay(schedule: readonly number[]): () => Promise<void> {
  let index = 0;
  return async (): Promise<void> => {
    const turns = schedule.length === 0 ? 0 : schedule[index % schedule.length] ?? 0;
    index += 1;
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  };
}
