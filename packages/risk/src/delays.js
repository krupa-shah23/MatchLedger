// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
export const microtaskDelay = () => Promise.resolve();
export function scheduleDelay(schedule) {
    let index = 0;
    return async () => {
        const turns = schedule.length === 0 ? 0 : schedule[index % schedule.length] ?? 0;
        index += 1;
        for (let turn = 0; turn < turns; turn += 1)
            await Promise.resolve();
    };
}
