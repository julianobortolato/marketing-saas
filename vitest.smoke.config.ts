import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

config({ path: '.env.smoke' })

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Smoke tests are stateful — run sequentially to avoid cross-test DB interference
    sequence: { concurrent: false },
    include: ['tests/smoke/**/*.smoke.test.ts'],
    reporters: ['verbose'],
  },
})
