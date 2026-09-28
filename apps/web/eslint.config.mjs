import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored @bklit registry source. No longer byte-identical to upstream:
    // chart-formatters.ts and chart-stat-flow.tsx resolve the app locale, and
    // stacked-bar.tsx is ours. Re-syncing with `shadcn add` overwrites those.
    "src/components/charts/**",
    "src/components/stat-card-chart.tsx",
    "src/components/stat-card-hover-bridge.tsx",
    "src/components/trend-badge.tsx",
    "src/components/shimmering-text.tsx",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
