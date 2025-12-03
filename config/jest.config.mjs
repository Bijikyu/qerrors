// jest.config.mjs - TypeScript ES Module configuration (React-enabled)
// Use ESM export to avoid CommonJS issues under "type": "module"
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

export default {
  preset: 'ts-jest/presets/default-esm',
  rootDir: PROJECT_ROOT,
  testEnvironment: 'node',
  // Ensure CommonJS require() exists in ESM tests
  setupFiles: [path.join(PROJECT_ROOT, 'config', 'jest-require-polyfill.cjs')],
  setupFilesAfterEnv: [path.join(PROJECT_ROOT, 'config', 'jest-setup.ts')],
  roots: [PROJECT_ROOT],
  testMatch: [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.GenerateTest.test.ts",
  "**/*.GenerateTest.test.tsx",
  "**/*.GeneratedTest.test.ts",
  "**/*.GeneratedTest.test.tsx",
  "**/manual-tests/**/*.test.ts",
  "**/generated-tests/**/*GeneratedTest*.test.ts",
  "**/generated-tests/**/*GeneratedTest*.test.tsx"
],
  testPathIgnorePatterns: [
  "/node_modules/",
  "/dist/",
  "/build/",
  "/__mocks__/"
],
  // Harden ignores to avoid duplicate manual mocks and compiled artifacts
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/build/'],
  watchPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/build/'],
  moduleFileExtensions: ["ts","tsx","js","jsx","json"],
  transform: {
  "^.+\\.(ts|tsx)$": [
    "ts-jest",
    {
      "useESM": true,
      "tsconfig": {
        "jsx": "react-jsx"
      }
    }
  ],
  "^.+\\.(js|jsx)$": [
    "ts-jest",
    {
      "useESM": true,
      "tsconfig": {
        "jsx": "react-jsx",
        "allowJs": true
      }
    }
  ]
},
  extensionsToTreatAsEsm: [".ts",".tsx"],
  transformIgnorePatterns: ['node_modules/(?!(?:qtests|@tanstack|@radix-ui|lucide-react|react-resizable-panels|cmdk|vaul)/)'],
  moduleNameMapper: {
  "^\\.\\./index\\.js$": "<rootDir>/index.ts",
  "^\\.\\./setup\\.js$": "<rootDir>/setup.ts",
  // Avoid mapping generic ../lib/* imports; interferes with node_modules packages (e.g., openai)
  "^\\.\\./utils/httpTest\\.shim\\.js$": "<rootDir>/utils/httpTest.shim.js",
  // Avoid over-broad mapping that intercepts node_modules internal imports like 'openai/../utils/*'
  "^(.*/httpTest\\.shim)\\.js$": "$1.js",
  "^external-service-client$": "<rootDir>/utils/jest-proxies/external-service-client.cjs",
  "^feature-x$": "<rootDir>/utils/jest-proxies/feature-x.cjs",
  "^(\\.{1,2}/.*)\\.js$": "$1",
  // Map qtests deep imports to compiled dist output (package lacks exports map)
  "^qtests/(.*)$": "<rootDir>/node_modules/qtests/dist/$1",
  "^mongoose$": "<rootDir>/__mocks__/mongoose.js",
  "^.+\\\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/fileMock.js",
  "^.+\\\\.(png|jpg|jpeg|gif|svg|webp|avif|ico|bmp)$": "<rootDir>/__mocks__/fileMock.js"
}
};
