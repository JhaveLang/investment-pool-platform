import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Project convention: descriptive camelCase identifiers, never single letters.
      "id-length": ["error", { min: 2, properties: "never" }],
      camelcase: ["error", { properties: "never", ignoreImports: true }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "drizzle/**", "next-env.d.ts"]),
]);

export default eslintConfig;
