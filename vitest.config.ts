import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],

    // 设置文件
    setupFiles: ['./tests/setup.ts'],

    // 超时配置
    testTimeout: 30000,
    hookTimeout: 30000,

    // 并行配置
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/*.example.ts',
      ],
    },

    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // 路径别名
    alias: {
      '@': './src',
      '@tests': './tests',
    },
  },
});
