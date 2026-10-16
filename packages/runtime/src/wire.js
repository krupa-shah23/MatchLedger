import { recoverPipeline } from "./recover-pipeline.js";
export async function wireRuntime(config) {
    const recovery = await recoverPipeline(config);
    return {
        recovery,
        books: recovery.books,
        riskCores: recovery.riskCores,
        engineState: recovery.engineState,
        ledgerState: recovery.ledgerState,
        owners: recovery.owners,
        watermark: recovery.watermark,
    };
}
