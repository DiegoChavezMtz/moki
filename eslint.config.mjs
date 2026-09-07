import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "prototipo/**"]),
  {
    files: ["src/core/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          regex: "^(?!@/core(?:/|$)|\\.{1,2}/)",
          message: "El core solo puede importar del propio core; no admite paquetes externos.",
        }, {
          regex: "(?:^|/)(?:adapters|app|shared|features)(?:/|$)",
          message: "Regla del hexágono: el core no conoce adapters, app, shared ni features.",
        }],
      }],
      "import/no-restricted-paths": ["error", {
        zones: [{ target: "./src/core", from: "./", except: ["./src/core"], message: "El core solo depende del core." }],
      }],
      "no-restricted-syntax": ["error", {
        selector: "ImportExpression",
        message: "Usa imports estáticos internos para mantener verificable la frontera del core.",
      }, {
        selector: "CallExpression[callee.name='require']",
        message: "Usa imports estáticos internos para mantener verificable la frontera del core.",
      }, {
        selector: "TSImportEqualsDeclaration",
        message: "Usa imports estáticos internos para mantener verificable la frontera del core.",
      }],
    },
  },
]);
