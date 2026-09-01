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
    // Deno-runtime kod (Supabase Edge Function) - inte del av Next.js-appen,
    // och `Deno`-globalen finns inte i denna ESLint-miljö.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
