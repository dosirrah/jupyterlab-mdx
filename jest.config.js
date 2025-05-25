const jestJupyterLab = require('@jupyterlab/testutils/lib/jest-config');

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

const baseConfig = jestJupyterLab(__dirname);

// // version prior to suggestons from ChatGPT in response to errors
// // when running `yarn test` from `jupyterlab-mdx` root of repo.
// //    /home/jovyan/jupyterlab-mdx/node_modules/@jupyter/react-components/lib/index.js:1
// //    ({"Object.<anonymous>":function(module,exports,require,__dirname,__filename,jest){export * from './Accordion.js';
// //                                                                                       ^^^^^^
// //
// //    SyntaxError: Unexpected token 'export'

//
// module.exports = {
//   ...baseConfig,
//   automock: false,
//   collectCoverageFrom: [
//     'src/**/*.{ts,tsx}',
//     '!src/**/*.d.ts',
//     '!src/**/.ipynb_checkpoints/*'
//   ],
//   coverageReporters: ['lcov', 'text'],
//   testRegex: 'src/.*/.*.spec.ts[x]?$',
//   transformIgnorePatterns: [`/node_modules/(?!${esModules}).+`]
// };


module.exports = {
  ...baseConfig,

  // 1) Tell Jest to use ts-jest for .ts/.tsx files
  preset: 'ts-jest',

  // 2) Use a browser-like DOM environment for tests
  testEnvironment: 'jsdom',

  // 3) Transform your TypeScript (and allow ESM under @jupyterlab/*)
  transform: {
    // first, let ts-jest handle TS files
    '^.+\\.(ts|tsx)$': 'ts-jest',
    // then, keep any other transforms your baseConfig may have
    ...baseConfig.transform
  },

  // 4) Make sure Jest will resolve .ts/.tsx modules
  moduleFileExtensions: [
    ...(baseConfig.moduleFileExtensions || []),
    'ts',
    'tsx'
  ],

  // 5) Only ignore node_modules *outside* of the JupyterLab ESM packages
  transformIgnorePatterns: [
    `/node_modules/(?!${esModules}).+`
  ],

  // your existing overrides:
  automock: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/.ipynb_checkpoints/*'
  ],
  coverageReporters: ['lcov', 'text'],
  testRegex: 'src/.*/.*.spec.ts[x]?$'
};
