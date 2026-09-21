import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const javascriptFiles = ["**/*.{js,jsx,cjs,mjs}"];
const typescriptFiles = ["**/*.{ts,tsx,mts}"];
const typedSourceFiles = [
  "apps/*/src/**/*.{ts,tsx}",
  "apps/*/App.tsx",
  "packages/*/src/**/*.{ts,tsx}",
];

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/.expo/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/out/**",
    "playwright-report/**",
    "test-results/**",
    "tmp/**",
    "reports/**",
    "zocdoc-screenshots/**",
    "apps/web/next-env.d.ts",
  ]),
  {
    name: "yardmatch/linter-options",
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    ...js.configs.recommended,
    name: "yardmatch/javascript",
    files: javascriptFiles,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    name: "yardmatch/typescript",
    files: typescriptFiles,
    extends: [tseslint.configs.recommended],
  },
  {
    name: "yardmatch/typed-source-safety",
    files: typedSourceFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-for-in-array": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
    },
  },
  {
    name: "yardmatch/react-hooks",
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    name: "yardmatch/next-core-web-vitals",
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-img-element": "error",
    },
    settings: {
      next: {
        rootDir: "apps/web",
      },
    },
  },
]);
