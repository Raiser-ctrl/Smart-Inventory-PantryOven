
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Ignore generated files and external dependencies.
  globalIgnores([
    // Next.js
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Python virtual environments
    ".venv/**",
    "**/.venv/**",
    "**/venv/**",

    // Python cache
    "**/__pycache__/**",

    // RAG vector database
    "rag/chroma_db/**",

    // Generated ML artifacts
    "ml_model/artifacts/**",
  ]),
]);

export default eslintConfig;
