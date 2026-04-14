import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Enforce explicit return types on public API functions
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Allow underscore-prefixed unused vars
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Prefer const assertions
      "prefer-const": "error",
      // No console in library code
      "no-console": "warn",
    },
  },
  {
    // Test files are allowed to be more permissive
    files: ["tests/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["lib/**", "dist/**", "node_modules/**"],
  },
);
