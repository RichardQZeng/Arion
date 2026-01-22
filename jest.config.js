module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  roots: ['<rootDir>/tests'],
  // Fix ESM import package in node_modules for nanoid
  transformIgnorePatterns: ['/node_modules/(?!nanoid/)'],
  // Modern ts-jest config (not deprecated globals)
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  }
}
