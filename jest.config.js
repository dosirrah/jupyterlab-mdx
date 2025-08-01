const jestJupyterLab = require('@jupyterlab/testutils/lib/jest-config');
const esModules = ['@jupyterlab/', '@codemirror', 'yjs', /* etc. */].join('|');
const baseConfig = jestJupyterLab(__dirname);

module.exports = {
  ...baseConfig,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    ...(baseConfig.transform || {})
  },
  moduleFileExtensions: [...(baseConfig.moduleFileExtensions || []), 'ts', 'tsx'],
  transformIgnorePatterns: [`/node_modules/(?!(?:${esModules})).+`],
  modulePathIgnorePatterns: ['<rootDir>/static/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  testRegex: 'src/__tests__/.*\\.spec\\.ts$'
};
