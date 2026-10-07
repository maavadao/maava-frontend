const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
};

const jestConfig = createJestConfig(customJestConfig);

// Override after next/jest to ensure jose ESM package is transformed
module.exports = async () => {
  const config = await jestConfig();
  config.transformIgnorePatterns = [
    '/node_modules/(?!(jose)/)',
    '\\.pnp\\.[^\\/]+$',
  ];
  return config;
};
