import { encodeMoney, decodeMoney } from "@matchledger/common";
export function encodeAndDecodeMoneyInMemory(amount) {
    const encoded = encodeMoney(amount);
    return decodeMoney(encoded);
}
export async function storeAndLoadMoney(client, key, amount) {
    const encoded = encodeMoney(amount);
    await client.set(key, encoded);
    const raw = await client.get(key);
    if (raw === null) {
        throw new Error(`Key ${key} not found in Redis`);
    }
    return decodeMoney(raw);
}
