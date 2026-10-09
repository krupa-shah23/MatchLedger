import tseslint from "typescript-eslint";
export default [
  { ignores: ["**/dist/**", "**/dist-test/**", "**/node_modules/**"] },
  ...tseslint.configs.recommended,
  { files: ["packages/engine-core/src/**/*.ts"], ignores: ["**/*.test.ts", "**/*.spec.ts", "packages/simulator/**"], rules: {
    "no-restricted-globals": ["error", {name:"Date",message:"Time is an input"},{name:"performance",message:"No clock"},{name:"process",message:"No environment"},{name:"setTimeout"},{name:"setInterval"},{name:"setImmediate"},{name:"queueMicrotask"},{name:"crypto"},{name:"fetch"}],
    "no-restricted-properties": ["error",{object:"Math",property:"random",message:"No randomness"},{object:"Date",property:"now"},{object:"performance",property:"now"}],
    "no-restricted-syntax": ["error",{selector:"AwaitExpression",message:"engine-core is synchronous"},{selector:"FunctionDeclaration[async=true], FunctionExpression[async=true], ArrowFunctionExpression[async=true]",message:"engine-core is synchronous"},{selector:"NewExpression[callee.name='Promise']",message:"engine-core is synchronous"}],
    "no-restricted-imports": ["error",{patterns:[{regex:"^(node:|[^./])",message:"engine-core imports only relative own files"}]}]
  }}
];
