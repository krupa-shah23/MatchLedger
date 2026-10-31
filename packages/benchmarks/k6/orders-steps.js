import http from "k6/http";
import { check } from "k6";

const apiBase = (__ENV.API_BASE_URL ?? "").replace(/\/$/, "");
const users = JSON.parse(__ENV.LOAD_USERS_FILE ? open(__ENV.LOAD_USERS_FILE) : (__ENV.LOAD_USERS_JSON ?? "[]"));
const stages = JSON.parse(__ENV.K6_STAGES_JSON ?? "[]");
const preAllocatedVUs = Number(__ENV.K6_PREALLOCATED_VUS ?? "1");
const maxVUs = Number(__ENV.K6_MAX_VUS ?? "1");
const tokens = {};

if (!apiBase) throw new Error("API_BASE_URL is required");
if (!Array.isArray(users) || !users.length || users.some((user) => !user.username || !user.password || !user.accountId)) {
  throw new Error("LOAD_USERS_FILE or LOAD_USERS_JSON must contain funded {username,password,accountId} entries");
}
if (!__ENV.LOAD_SYMBOL || !/^[1-9][0-9]*$/.test(__ENV.LOAD_QUANTITY ?? "") || !/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(__ENV.LOAD_PRICE ?? "")) {
  throw new Error("LOAD_SYMBOL, positive integer LOAD_QUANTITY and decimal LOAD_PRICE are required");
}
if (!stages.length || stages.some((stage) => !Number.isFinite(stage.target) || stage.target < 0 || !/^\d+(ms|s|m)$/.test(stage.duration))) {
  throw new Error("K6_STAGES_JSON must be a non-empty array of {duration,target} stages");
}
if (!Number.isInteger(preAllocatedVUs) || preAllocatedVUs < 1 || !Number.isInteger(maxVUs) || maxVUs < preAllocatedVUs) {
  throw new Error("K6 VU limits are invalid");
}

export const options = {
  scenarios: {
    orders: {
      executor: "ramping-arrival-rate",
      startRate: stages[0].target,
      timeUnit: "1s",
      preAllocatedVUs,
      maxVUs,
      stages,
    },
  },
  thresholds: {
    http_req_failed: ["rate==0"],
    dropped_iterations: ["count==0"],
  },
};

function tokenForVu() {
  if (tokens[__VU]) return tokens[__VU];
  const user = users[(__VU - 1) % users.length];
  const response = http.post(`${apiBase}/auth/login`, JSON.stringify({
    username: user.username,
    password: user.password,
  }), { headers: { "Content-Type": "application/json" } });
  check(response, { "load VU login succeeds": (result) => result.status === 200 });
  if (response.status !== 200) throw new Error(`load VU login failed with HTTP ${response.status}`);
  tokens[__VU] = response.json("token");
  if (typeof tokens[__VU] !== "string" || !tokens[__VU]) throw new Error("login response did not include a bearer token");
  return tokens[__VU];
}

export default function () {
  const response = http.post(`${apiBase}/orders`, JSON.stringify({
    clientOrderId: `k6:${__VU}:${__ITER}`,
    symbol: __ENV.LOAD_SYMBOL,
    side: "BUY",
    type: "LIMIT",
    timeInForce: "GTC",
    quantity: __ENV.LOAD_QUANTITY,
    price: __ENV.LOAD_PRICE,
  }), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenForVu()}`,
    },
  });
  check(response, { "order durably accepted": (result) => result.status === 202 });
}
