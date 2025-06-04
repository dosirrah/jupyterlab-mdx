// jest.config.js
console.log("➡️  jest.config.js was loaded");


const jestJupyterLab = require('@jupyterlab/testutils/lib/jest-config');

// Any ESM packages you depend on under node_modules.
// We will force Jest to transform these rather than ignore them.
const esModules = [
  '@codemirror',
  '@jupyter/ydoc',
  '@jupyterlab/',
  'lib0',
  'nanoid',
  'vscode-ws-jsonrpc',
  'y-protocols',
  'y-websocket',
  'yjs'
].join('|');

// Start from the standard JupyterLab Jest settings:
const baseConfig = jestJupyterLab(__dirname);

module.exports = {
  ...baseConfig,

  // ─── 1) Prevent the haste collision for static/package.json ────────────
  // Static/ contains its own package.json, which Jest sees as another "jupyterlab-mdx" module.
  // By ignoring <rootDir>/static/, Jest won’t try to index that package.json.
  modulePathIgnorePatterns: [
    '<rootDir>/static/'
  ],

  // ─── 2) Ensure TS and ESM under @jupyterlab/* get transformed ─────────
  // Tell Jest to use ts-jest for TypeScript files:
  preset: 'ts-jest',
  // Use jsdom so your DOM-based tests (document.createElement, etc.) work
  testEnvironment: 'jsdom',

  // Transform definitions:
  transform: {
    // Run all .ts/.tsx files through ts-jest
    '^.+\\.(ts|tsx)$': 'ts-jest',
    // If baseConfig already has transforms, spread them here (optional):
    ...baseConfig.transform
  },

  // Let Jest resolve .ts and .tsx along with any previous extensions:
  moduleFileExtensions: [
    ...(baseConfig.moduleFileExtensions || []),
    'ts',
    'tsx'
  ],

  moduleNameMapper: {
    // everything under @jupyterlab/cells → __mocks__/@jupyterlab/cells.js
    '^@jupyterlab/cells$': '<rootDir>/__mocks__/@jupyterlab/cells.js',
    '^@jupyterlab/notebook$': '<rootDir>/__mocks__/@jupyterlab/notebook.js',

    // catch any deeper imports, e.g. @jupyterlab/cells/lib/foo
    '^@jupyterlab/cells/(.*)$': '<rootDir>/__mocks__/@jupyterlab/cells.js',
    '^@jupyterlab/cells$': '<rootDir>/__mocks__/@jupyterlab/cells.js',

    // similarly for other JupyterLab packages you import in xr.ts:
    '^@jupyterlab/ui-components/(.*)$': '<rootDir>/__mocks__/@jupyter/react-components.js',
    '^@jupyterlab/ui-components$': '<rootDir>/__mocks__/@jupyter/react-components.js',

    // if xr.ts imports anything under @jupyterlab, point to an empty mock:
    '^@jupyterlab/(.*)$': '<rootDir>/__mocks__/@jupyterlab/notebook.js',

    // and catch @jupyter/react-components explicitly:
    '^@jupyter/react-components$': '<rootDir>/__mocks__/@jupyter/react-components.js',
    '^@jupyter/react-components/(.*)$': '<rootDir>/__mocks__/@jupyter/react-components.js'
  },

  // We are using moduleNameMapper above instead of the ignore patterns.
  transformIgnorePatterns: [],

  // // By default Jest ignores node_modules entirely. We need Jest to pass
  // // any @jupyterlab/* (and similar) ESM files through the ts-jest transformer.
  // transformIgnorePatterns: [
  //   // Explanation:
  //   //   ^<rootDir>/node_modules/(?!                      ← look under node_modules/
  //   //       (?:
  //   //         @codemirror|
  //   //         @jupyter/ydoc|
  //   //         @jupyterlab/|
  //   //         @jupyter/|
  //   //         @lumino/|
  //   //         lib0|
  //   //         nanoid|
  //   //         vscode-ws-jsonrpc|
  //   //         y-protocols|
  //   //         y-websocket|
  //   //         yjs
  //   //       )
  //   //     )                                             ← end negative lookahead
  //   //   .+                                             ← any path under those allowed names
  //   //
  //   `^<rootDir>/node_modules/(?!(` + esModules + `)).+`
  // ],

  // Old version that seems to not work?
  //transformIgnorePatterns: [
  //  `/node_modules/(?!(?:${esModules})).+`
  //],

  // ─── Your existing overrides ────────────────────────────────────────────
  automock: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/.ipynb_checkpoints/*'
  ],
  coverageReporters: ['lcov', 'text'],
  testRegex: 'src/.*/.*.spec.ts[x]?$'
};

