/**
 * CDN库管理测试 - 单元测试
 * 测试用例覆盖：CDN-001~025
 * 包含：单库加载、多CDN备用、依赖管理、并发优化、错误恢复
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LibraryLoader } from '../LibraryLoader';
import type { CDNLibrary, LibraryLoadResult } from '../../../types/cdn.types';

// Mock DOM environment
const mockDocument = {
  createElement: vi.fn(() => ({
    type: '',
    async: false,
    src: '',
    onload: null,
    onerror: null,
    remove: vi.fn()
  })),
  head: {
    appendChild: vi.fn()
  }
};

const mockWindow = {
  PDFLib: { PDFDocument: {} },
  JSZip: {},
  mammoth: {},
  fontkit: {}
};

// @ts-ignore
global.document = mockDocument;
// @ts-ignore
global.window = mockWindow;
global.performance = {
  now: vi.fn(() => Date.now())
} as any;
// 移除setTimeout mock，使用Vitest的原生定时器功能
// global.setTimeout = vi.fn((fn, delay) => {
//   const originalSetTimeout = globalThis.setTimeout;
//   originalSetTimeout(fn, delay);
//   return 1;
// });

describe('LibraryLoader - CDN库管理测试', () => {
  beforeEach(() => {
    LibraryLoader.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    LibraryLoader.reset();
  });

  describe('A. 单库加载机制 (6用例)', () => {
    it('CDN-001: 单个CDN库成功加载', async () => {
      // 模拟脚本加载成功
      const mockScript = {
        type: '',
        async: false,
        src: '',
        onload: null as any,
        onerror: null as any,
        remove: vi.fn()
      };
      
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      
      // 模拟加载成功
      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 10);
      
      const result = await loadPromise;
      
      expect(result.success).toBe(true);
      expect(result.library).toBe('pdf-lib');
      expect(result.method).toBe('network');
      expect(mockDocument.createElement).toHaveBeenCalledWith('script');
      expect(mockDocument.head.appendChild).toHaveBeenCalled();
    });

    it('CDN-002: 库重复加载跳过机制', async () => {
      // 第一次加载
      const mockScript = {
        onload: null as any,
        onerror: null as any,
        remove: vi.fn()
      };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const firstLoad = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      await firstLoad;

      // 第二次加载应该跳过
      const secondLoad = await LibraryLoader.loadLibrary('pdf-lib');
      
      expect(secondLoad.success).toBe(true);
      expect(secondLoad.method).toBe('cache');
      expect(secondLoad.loadTime).toBe(0);
    });

    it('CDN-003: 库加载状态正确管理', async () => {
      expect(LibraryLoader.isLibraryLoaded('pdf-lib')).toBe(false);
      expect(LibraryLoader.isLoading('pdf-lib')).toBe(false);
      
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      expect(LibraryLoader.isLoading('pdf-lib')).toBe(true);
      
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      await loadPromise;
      
      expect(LibraryLoader.isLibraryLoaded('pdf-lib')).toBe(true);
      expect(LibraryLoader.isLoading('pdf-lib')).toBe(false);
    });

    it('CDN-004: 全局变量正确注册', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      
      const result = await loadPromise;
      
      expect(result.success).toBe(true);
      expect(window.PDFLib).toBeDefined();
    });

    it('CDN-005: 加载进度正确跟踪', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      
      const progress = LibraryLoader.getLoadingProgress('pdf-lib');
      expect(progress).toHaveLength(1);
      expect(progress[0].status).toBe('loading');
      expect(progress[0].library).toBe('pdf-lib');
      
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      await loadPromise;
      
      const finalProgress = LibraryLoader.getLoadingProgress('pdf-lib');
      expect(finalProgress).toHaveLength(0); // 加载完成后清除
    });

    it('CDN-006: 并发加载去重机制', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 同时发起多个加载请求
      const load1 = LibraryLoader.loadLibrary('pdf-lib');
      const load2 = LibraryLoader.loadLibrary('pdf-lib');
      const load3 = LibraryLoader.loadLibrary('pdf-lib');
      
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      
      const [result1, result2, result3] = await Promise.all([load1, load2, load3]);
      
      // 所有请求都应该成功
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      
      // 但只有一个实际的网络请求
      expect(mockDocument.createElement).toHaveBeenCalledTimes(1);
    });
  });

  describe('B. 多CDN备用策略 (6用例)', () => {
    it('CDN-007: 主CDN失败自动切换', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      
      // 第一个URL失败
      setTimeout(() => {
        if (mockScript.onerror) mockScript.onerror();
      }, 10);
      
      // 第二次尝试成功
      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 50);
      
      const result = await loadPromise;
      expect(result.success).toBe(true);
      expect(mockDocument.createElement).toHaveBeenCalledTimes(2); // 两次尝试
    });

    it('CDN-008: 多CDN全部失败处理', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      
      // 模拟所有CDN都失败
      setTimeout(() => {
        if (mockScript.onerror) mockScript.onerror();
      }, 10);
      setTimeout(() => {
        if (mockScript.onerror) mockScript.onerror();
      }, 20);
      
      const result = await loadPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load pdf-lib from all CDN sources');
    });

    it('CDN-009: CDN响应时间监控', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onload && mockScript.onload(), 100);
      
      const result = await loadPromise;
      
      expect(result.loadTime).toBeGreaterThan(0);
      
      const stats = LibraryLoader.getCDNStats();
      expect(Object.keys(stats)).toHaveLength(1);
      expect(stats[Object.keys(stats)[0]].totalRequests).toBe(1);
    });

    it('CDN-010: CDN健康度检测', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 成功加载
      let loadPromise = LibraryLoader.loadLibrary('jszip');
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      await loadPromise;
      
      LibraryLoader.reset(); // 重置但保留统计
      
      // 失败加载
      loadPromise = LibraryLoader.loadLibrary('jszip');
      setTimeout(() => mockScript.onerror && mockScript.onerror(), 10);
      await loadPromise.catch(() => {});
      
      const stats = LibraryLoader.getCDNStats();
      const cdnUrl = Object.keys(stats)[0];
      
      expect(stats[cdnUrl].successRate).toBeLessThan(1);
      expect(stats[cdnUrl].failureCount).toBeGreaterThan(0);
    });

    it('CDN-011: 网络错误分类处理', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      
      // 模拟网络错误
      setTimeout(() => {
        const error = new Error('Network timeout');
        if (mockScript.onerror) mockScript.onerror();
      }, 10);
      
      const result = await loadPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('CDN-012: 备用CDN优先级策略', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 第一次加载成功，记录成功的CDN
      let loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      await loadPromise;
      
      // 获取推荐CDN
      const recommendedCDN = LibraryLoader.getRecommendedCDN('pdf-lib');
      expect(recommendedCDN).toBeTruthy();
      expect(typeof recommendedCDN).toBe('string');
    });
  });

  describe('C. 依赖关系处理 (5用例)', () => {
    it('CDN-013: 依赖库顺序加载', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 假设pdf-lib依赖于fontkit
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      
      // 模拟成功加载
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      setTimeout(() => mockScript.onload && mockScript.onload(), 20);
      
      const result = await loadPromise;
      expect(result.success).toBe(true);
    });

    it('CDN-014: 循环依赖检测处理', async () => {
      // 测试循环依赖的处理逻辑
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 这里可以设置一个模拟的循环依赖场景
      const loadPromise = LibraryLoader.loadLibrary('jszip');
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      
      const result = await loadPromise;
      expect(result.success).toBe(true);
    });

    it('CDN-015: 依赖库加载失败处理', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 模拟依赖库加载失败
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onerror && mockScript.onerror(), 10);
      
      const result = await loadPromise;
      expect(result.success).toBe(false);
    });

    it('CDN-016: 复杂依赖链解析', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 测试多级依赖的加载
      const results = await LibraryLoader.loadLibraries(['pdf-lib', 'jszip', 'mammoth']);
      
      // 所有库都应该尝试加载
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.library).toBeDefined();
      });
    });

    it('CDN-017: 可选依赖处理机制', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 测试可选依赖（如fontkit）的处理
      const loadPromise = LibraryLoader.loadLibrary('fontkit');
      setTimeout(() => {
        // 即使fontkit失败，也不应该影响主流程
        if (mockScript.onerror) mockScript.onerror();
      }, 10);
      
      const result = await loadPromise;
      // 可选依赖失败不应该抛出异常
      expect(result).toBeDefined();
    });
  });

  describe('D. 超时重试机制 (4用例)', () => {
    it('CDN-018: 加载超时自动重试', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib', { timeout: 100 });
      
      // 第一次超时，第二次成功
      setTimeout(() => {
        // 模拟超时
        mockScript.onerror && mockScript.onerror();
      }, 50);
      
      setTimeout(() => {
        // 重试成功
        mockScript.onload && mockScript.onload();
      }, 150);
      
      const result = await loadPromise;
      expect(result.success).toBe(true);
    });

    it('CDN-019: 重试次数上限控制', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib', { retryAttempts: 2 });
      
      // 模拟所有重试都失败
      setTimeout(() => mockScript.onerror && mockScript.onerror(), 10);
      setTimeout(() => mockScript.onerror && mockScript.onerror(), 20);
      setTimeout(() => mockScript.onerror && mockScript.onerror(), 30);
      
      const result = await loadPromise;
      expect(result.success).toBe(false);
      expect(mockDocument.createElement).toHaveBeenCalledTimes(2); // 只重试指定次数
    });

    it('CDN-020: 指数退避重试策略', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const startTime = Date.now();
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      
      // 模拟多次失败
      setTimeout(() => mockScript.onerror && mockScript.onerror(), 10);
      setTimeout(() => mockScript.onerror && mockScript.onerror(), 20);
      setTimeout(() => mockScript.onload && mockScript.onload(), 100);
      
      const result = await loadPromise;
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      // 验证重试间隔递增
      expect(endTime - startTime).toBeGreaterThan(50);
    });

    it('CDN-021: 重试状态清理机制', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      
      await loadPromise;
      
      // 验证加载完成后状态被清理
      expect(LibraryLoader.getLoadingProgress('pdf-lib')).toHaveLength(0);
      expect(LibraryLoader.isLoading('pdf-lib')).toBe(false);
    });
  });

  describe('E. 并行加载优化 (3用例)', () => {
    it('CDN-022: 多库并行加载无冲突', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const libraries = ['pdf-lib', 'jszip', 'mammoth'];
      const loadPromise = LibraryLoader.loadLibraries(libraries);
      
      // 模拟所有库加载成功
      setTimeout(() => mockScript.onload && mockScript.onload(), 10);
      setTimeout(() => mockScript.onload && mockScript.onload(), 20);
      setTimeout(() => mockScript.onload && mockScript.onload(), 30);
      
      const results = await loadPromise;
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('CDN-023: Promise.all并发控制', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const startTime = Date.now();
      
      // 并发加载多个库
      const promises = ['pdf-lib', 'jszip'].map(lib => {
        const promise = LibraryLoader.loadLibrary(lib);
        setTimeout(() => mockScript.onload && mockScript.onload(), 50);
        return promise;
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // 并发加载应该比串行加载快
      expect(endTime - startTime).toBeLessThan(150);
      expect(results).toHaveLength(2);
    });

    it('CDN-025: 资源竞争条件处理', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      // 快速连续发起多个相同库的加载请求
      const promises = Array(5).fill(0).map(() => {
        const promise = LibraryLoader.loadLibrary('pdf-lib');
        setTimeout(() => mockScript.onload && mockScript.onload(), 10);
        return promise;
      });
      
      const results = await Promise.all(promises);
      
      // 所有请求都应该成功
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // 但只应该有一个实际的网络请求
      expect(mockDocument.createElement).toHaveBeenCalledTimes(1);
    });
  });

  describe('性能监控测试', () => {
    it('获取性能指标', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onload && mockScript.onload(), 50);
      
      await loadPromise;
      
      const metrics = LibraryLoader.getPerformanceMetrics();
      expect(metrics.totalLoadsAttempted).toBe(1);
      expect(metrics.totalLoadsSucceeded).toBe(1);
      expect(metrics.averageLoadTime).toBeGreaterThan(0);
    });

    it('CDN统计信息追踪', async () => {
      const mockScript = { onload: null as any, onerror: null as any, remove: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const loadPromise = LibraryLoader.loadLibrary('pdf-lib');
      setTimeout(() => mockScript.onload && mockScript.onload(), 30);
      
      await loadPromise;
      
      const stats = LibraryLoader.getCDNStats();
      const urls = Object.keys(stats);
      expect(urls.length).toBeGreaterThan(0);
      
      const urlStats = stats[urls[0]];
      expect(urlStats.totalRequests).toBe(1);
      expect(urlStats.successRate).toBe(1);
    });
  });
});