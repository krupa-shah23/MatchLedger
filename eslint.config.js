import tseslint from "typescript-eslint";

const pureRestrictedRules = {
  "no-restricted-globals": ["error", { name: "Date", message: "Time is an input" }, { name: "performance", message: "No clock" }, { name: "process", message: "No environment" }, { name: "setTimeout" }, { name: "setInterval" }, { name: "setImmediate" }, { name: "queueMicrotask" }, { name: "crypto" }, { name: "fetch" }],
  "no-restricted-properties": ["error", { object: "Math", property: "random", message: "No randomness" }, { object: "Date", property: "now" }, { object: "performance", property: "now" }],
  "no-restricted-syntax": ["error", { selector: "AwaitExpression", message: "Pure code is synchronous" }, { selector: "FunctionDeclaration[async=true], FunctionExpression[async=true], ArrowFunctionExpression[async=true]", message: "Pure code is synchronous" }, { selector: "NewExpression[callee.name='Promise']", message: "Pure code is synchronous" }],
  "no-restricted-imports": ["error", { patterns: [{ group: ["node:*"], message: "node:* imports are forbidden in the pure zone" }, { group: ["@matchledger/*", "!@matchledger/common"], message: "Pure code may import only relative files and type-only @matchledger/common" }] }],
};

export default [
  { ignores: ["**/dist/**", "**/dist-test/**", "**/node_modules/**"] },
  { ...tseslint.configs.recommended[0] },
  { rules: { "@typescript-eslint/no-explicit-any": "warn" } },
  { files: ["**/*.test.ts", "**/*.test.js", "**/*.spec.ts", "**/*.spec.js", "**/test/**", "packages/api/src/**", "packages/journal/src/test-*", "packages/engine-core/test/**"], rules: { "@typescript-eslint/no-unused-vars": "off", "@typescript-eslint/no-explicit-any": "off" } },
  { files: ["packages/engine-core/src/**/*.ts"], ignores: ["**/*.test.ts", "**/*.spec.ts", "packages/simulator/**"], rules: {
    "no-restricted-globals": ["error", { name: "Date", message: "Time is an input" }, { name: "performance", message: "No clock" }, { name: "process", message: "No environment" }, { name: "setTimeout" }, { name: "setInterval" }, { name: "setImmediate" }, { name: "queueMicrotask" }, { name: "crypto" }, { name: "fetch" }],
    "no-restricted-properties": ["error", { object: "Math", property: "random", message: "No randomness" }, { object: "Date", property: "now" }, { object: "performance", property: "now" }],
    "no-restricted-syntax": ["error", { selector: "AwaitExpression", message: "engine-core is synchronous" }, { selector: "FunctionDeclaration[async=true], FunctionExpression[async=true], ArrowFunctionExpression[async=true]", message: "engine-core is synchronous" }, { selector: "NewExpression[callee.name='Promise']", message: "engine-core is synchronous" }],
    "no-restricted-imports": ["error", { patterns: [{ regex: "^(node:|[^./])", message: "engine-core imports only relative own files" }] }],
  } },
  { files: ["packages/risk/src/core/**/*.ts", "packages/ledger/src/ledger.ts", "packages/ledger/src/tx-id.ts", "packages/recon/src/core/**/*.ts"], ignores: ["**/*.test.ts", "**/*.spec.ts", "packages/risk/src/persistence/**", "packages/risk/src/recovery/**", "packages/ledger/src/persistence/**"], rules: pureRestrictedRules },
];
