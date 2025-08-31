/**
 * Vitest 测试配置
 * 支持 TypeScript、React、Canvas API Mock
 * 目标：380个测试用例，95%+ 代码覆盖率
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // 测试环境配置
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.test.{ts,tsx}',
        '!src/test-*.ts',
        '!src/**/index.ts'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.config.{js,ts}',
        'src/main.tsx',
        'src/App.tsx'
      ],
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        // 关键模块要求更高覆盖率
        'src/utils/cdn/': {
          branches: 98,
          functions: 98,
          lines: 98,
          statements: 98
        },
        'src/engines/': {
          branches: 96,
          functions: 96,
          lines: 96,
          statements: 96
        },
        'src/stores/': {
          branches: 97,
          functions: 97,
          lines: 97,
          statements: 97
        }
      }
    },
    
    // 测试文件匹配规则 - 包含所有测试套件
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      // 单元测试
      'src/utils/cdn/__tests__/*.test.ts',
      'src/utils/document/__tests__/*.test.ts',
      'src/engines/canvas/__tests__/*.test.ts',
      'src/engines/pdf/__tests__/*.test.ts',
      'src/stores/__tests__/*.test.ts',
      // 集成测试
      'src/__tests__/integration/*.test.ts',
      // E2E测试
      'src/__tests__/e2e/*.test.ts',
      // 兼容性测试
      'src/__tests__/compatibility/*.test.ts',
      // 性能测试
      'src/__tests__/performance/*.test.ts'
    ],
    
    // 测试超时配置
    testTimeout: 30000, // 30秒
    hookTimeout: 10000,  // 10秒
    
    // 并发测试配置
    threads: true,
    minThreads: 1,
    maxThreads: 4,
    
    // 测试报告配置
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/report.html'
    },
    
    // 监听模式配置
    watch: false,
    
    // Mock 配置
    deps: {
      inline: [
        // 强制内联的依赖
        '@testing-library/react',
        '@testing-library/jest-dom'
      ]
    },
    
    // 测试环境变量
    env: {
      NODE_ENV: 'test',
      VITE_TEST_MODE: 'true'
    }
  }
});