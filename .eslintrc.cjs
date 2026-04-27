/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-console": "warn",
  },
  overrides: [
    {
      files: ["src/common/logger/**/*.ts", "src/cmd/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["**/*.test.ts", "tests/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  ignorePatterns: ["dist", "node_modules", "coverage", "*.cjs"],
};
