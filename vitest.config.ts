import { defineConfig } from 'vitest/config'

const config = defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup/git-env.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80
      }
    }
  }
})

export default config
