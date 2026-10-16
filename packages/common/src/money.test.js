import { describe, it } from "vitest";
import fc from "fast-check";
import { decodeMoney, encodeMoney, MAX_MONEY, MIN_MONEY } from "./money.js";
describe("P10 money codec", () => it("round-trips bigint through JSON", () => fc.assert(fc.property(fc.bigInt({ min: MIN_MONEY, max: MAX_MONEY }), value => decodeMoney(JSON.parse(JSON.stringify(encodeMoney(value)))) === value))));
