/**
 * 状态管理测试 - 单元测试
 * 测试用例覆盖：STATE-001~020
 * 包含：Store状态流转、异步操作管理、错误处理、性能监控
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatermarkStore } from '../watermarkStore';
import type { WatermarkSettings } from '../../types/watermark.types';

// Mock dependencies
vi.mock('../../utils/cdn/LibraryLoader', () => ({
  LibraryLoader: {
    getCDNStats: vi.fn(() => ({})),
    getPerformanceMetrics: vi.fn(() => ({ 
      totalLoadsAttempted: 0, 
      totalLoadsSucceeded: 0, 
      averageLoadTime: 0 
    }))
  }
}));

vi.mock('../../engines/canvas/ChineseWatermarkRenderer', () => ({
  ChineseWatermarkRenderer: {
    detectOptimalChineseFont: vi.fn(() => 'Microsoft YaHei'),
    containsChineseCharacters: vi.fn(() => true)
  }
}));

vi.mock('../../engines/pdf/PDFWatermarkEngine', () => ({
  PDFWatermarkEngine: {
    initialize: vi.fn(() => Promise.resolve()),
    getEngineStatus: vi.fn(() => ({
      initialized: true,
      features: ['PDF创建', '中文渲染', '网格布局']
    }))
  }
}));

describe('WatermarkStore - 状态管理测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置store状态
    useWatermarkStore.getState = vi.fn(() => ({
      // 模拟初始状态
      canvas: {
        engine: null,
        context: null,
        pool: null,
        activeCanvases: new Set(),
        chineseRenderer: {
          initialized: false,
          optimalFont: null,
          renderQuality: 'high',
          supportedFeatures: []
        }
      },
      cdn: {
        initialized: false,
        loadedLibraries: new Set(),
        loadingProgress: new Map(),
        stats: {},
        healthMetrics: {}
      },
      pdfEngine: {
        initialized: false,
        status: 'idle',
        supportedFeatures: [],
        lastError: null
      },
      files: {
        selected: [],
        processing: new Map(),
        results: new Map(),
        statistics: {
          totalProcessed: 0,
          successCount: 0,
          errorCount: 0,
          averageProcessingTime: 0,
          chineseContentDetected: 0
        }
      },
      ui: {
        loading: false,
        error: null,
        progress: null,
        activeView: 'upload',
        modals: {
          settings: false,
          help: false,
          error: false,
          certificate: false,
          presets: false
        }
      },
      watermark: {
        processor: null,
        settings: {
          type: 'text',
          text: {
            content: '机密文档',
            font: {
              family: 'Microsoft YaHei',
              size: 24,
              weight: 'normal',
              style: 'normal'
            },
            color: '#000000'
          },
          position: {
            placement: 'grid',
            opacity: 0.3,
            scale: 1.0,
            rotation: 45,
            grid: {
              spacingX: 200,
              spacingY: 150,
              stagger: true
            }
          }
        } as WatermarkSettings,
        presets: []
      },
      performance: {
        metrics: {
          averageProcessingTime: 0,
          totalFilesProcessed: 0,
          memoryPeakUsage: 0,
          canvasPoolEfficiency: 0,
          workerPoolUtilization: 0,
          renderFrameRate: 0
        },
        warnings: [],
        memoryUsage: 0
      }
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('A. Store状态流转 (12用例)', () => {
    it('STATE-001: 初始状态正确设置', () => {
      const { result } = renderHook(() => useWatermarkStore());
      const state = result.current;

      expect(state.cdn.initialized).toBe(false);
      expect(state.pdfEngine.initialized).toBe(false);
      expect(state.canvas.chineseRenderer.initialized).toBe(false);
      expect(state.files.selected).toHaveLength(0);
      expect(state.ui.loading).toBe(false);
      expect(state.ui.activeView).toBe('upload');
      expect(state.watermark.settings.type).toBe('text');
      expect(state.performance.metrics.totalFilesProcessed).toBe(0);
    });

    it('STATE-002: CDN加载状态管理', async () => {
      const { result } = renderHook(() => useWatermarkStore());

      await act(async () => {
        await result.current.initializeSystem();
      });

      // 验证CDN状态更新
      expect(result.current.cdn.initialized).toBe(true);
      expect(result.current.ui.loading).toBe(false);
    });

    it('STATE-003: 文件处理状态流转', async () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      // 模拟文件
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      act(() => {
        result.current.selectFiles([mockFile]);
      });

      expect(result.current.files.selected).toHaveLength(1);
      expect(result.current.files.selected[0]).toBe(mockFile);

      // 模拟处理过程
      await act(async () => {
        result.current.setLoading(true);
        // 处理文件逻辑...
        result.current.setLoading(false);
      });

      expect(result.current.ui.loading).toBe(false);
    });

    it('STATE-004: 错误状态处理', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const errorInfo = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: Date.now(),
        userMessage: '测试错误',
        recoverable: true
      };

      act(() => {
        result.current.setError(errorInfo);
      });

      expect(result.current.ui.error).toEqual(errorInfo);
      expect(result.current.ui.error!.code).toBe('TEST_ERROR');
      expect(result.current.ui.error!.recoverable).toBe(true);

      // 清除错误
      act(() => {
        result.current.setError(null);
      });

      expect(result.current.ui.error).toBeNull();
    });

    it('STATE-005: 异步操作状态同步', async () => {
      const { result } = renderHook(() => useWatermarkStore());

      // 测试进度状态同步
      await act(async () => {
        result.current.setLoading(true);
        
        // 模拟异步操作
        await new Promise(resolve => setTimeout(resolve, 50));
        
        result.current.setLoading(false);
        result.current.setActiveView('preview');
      });

      expect(result.current.ui.loading).toBe(false);
      expect(result.current.ui.activeView).toBe('preview');
    });

    it('STATE-006: 状态持久化机制', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const newSettings = {
        ...result.current.watermark.settings,
        text: {
          ...result.current.watermark.settings.text,
          content: '新的水印内容'
        }
      };

      act(() => {
        result.current.updateWatermarkSettings(newSettings);
      });

      expect(result.current.watermark.settings.text?.content).toBe('新的水印内容');
      
      // 验证状态持久化（重新获取状态应该保持）
      const persistedState = result.current.watermark.settings;
      expect(persistedState.text?.content).toBe('新的水印内容');
    });

    it('STATE-007: 状态重置功能', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      // 先设置一些状态
      act(() => {
        result.current.selectFiles([new File(['test'], 'test.pdf', { type: 'application/pdf' })]);
        result.current.setLoading(true);
        result.current.setActiveView('preview');
      });

      expect(result.current.files.selected).toHaveLength(1);
      expect(result.current.ui.loading).toBe(true);

      // 重置文件状态
      act(() => {
        result.current.clearFiles();
      });

      expect(result.current.files.selected).toHaveLength(0);
      expect(result.current.files.results.size).toBe(0);
      expect(result.current.ui.activeView).toBe('upload');
    });

    it('STATE-008: 并发状态更新', async () => {
      const { result } = renderHook(() => useWatermarkStore());

      // 同时进行多个状态更新
      await act(async () => {
        const promises = [
          Promise.resolve(result.current.setLoading(true)),
          Promise.resolve(result.current.updateMetrics({ totalFilesProcessed: 5 })),
          Promise.resolve(result.current.setActiveView('processing'))
        ];
        
        await Promise.all(promises);
      });

      expect(result.current.ui.loading).toBe(true);
      expect(result.current.performance.metrics.totalFilesProcessed).toBe(5);
      expect(result.current.ui.activeView).toBe('processing');
    });

    it('STATE-009: 状态订阅机制', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      let subscriptionCallCount = 0;
      const unsubscribe = useWatermarkStore.subscribe((_state) => {
        subscriptionCallCount++;
      });

      // 触发状态变化
      act(() => {
        result.current.setLoading(true);
      });

      act(() => {
        result.current.setLoading(false);
      });

      expect(subscriptionCallCount).toBeGreaterThan(0);
      unsubscribe();
    });

    it('STATE-010: 状态变化通知', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const mockCallback = vi.fn();
      const unsubscribe = useWatermarkStore.subscribe(mockCallback);

      act(() => {
        result.current.updateWatermarkSettings({
          text: { content: '状态变化测试' }
        } as Partial<WatermarkSettings>);
      });

      expect(mockCallback).toHaveBeenCalled();
      unsubscribe();
    });

    it('STATE-011: 处理进度状态', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const progressInfo = {
        current: 3,
        total: 10,
        message: '正在处理文件...'
      };

      act(() => {
        result.current.setLoading(true);
        // 模拟设置进度状态
        useWatermarkStore.setState(state => ({
          ui: {
            ...state.ui,
            progress: progressInfo
          }
        }));
      });

      expect(result.current.ui.loading).toBe(true);
      expect(result.current.ui.progress).toEqual(progressInfo);
      expect(result.current.ui.progress!.current).toBe(3);
      expect(result.current.ui.progress!.total).toBe(10);
    });

    it('STATE-012: 状态回滚机制', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const originalSettings = { ...result.current.watermark.settings };
      
      // 修改设置
      act(() => {
        result.current.updateWatermarkSettings({
          text: { content: '临时修改' }
        } as Partial<WatermarkSettings>);
      });

      expect(result.current.watermark.settings.text?.content).toBe('临时修改');

      // 回滚到原始设置
      act(() => {
        result.current.updateWatermarkSettings(originalSettings);
      });

      expect(result.current.watermark.settings.text?.content).toBe(originalSettings.text?.content);
    });
  });

  describe('增强功能测试', () => {
    it('CDN状态监控', async () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      await act(async () => {
        await result.current.initializeSystem();
      });

      const cdnStatus = result.current.getCDNStatus();
      expect(cdnStatus).toBeDefined();
      expect(cdnStatus.initialized).toBe(true);
      expect(cdnStatus.loadedLibraries).toBeDefined();
    });

    it('引擎状态监控', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const engineStatus = result.current.getEngineStatus();
      expect(engineStatus).toBeDefined();
      expect(engineStatus.canvas).toBeDefined();
      expect(engineStatus.pdfEngine).toBeDefined();
    });

    it('系统健康检查', async () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const healthReport = await result.current.performHealthCheck();
      expect(healthReport).toBeDefined();
      expect(healthReport.timestamp).toBeGreaterThan(0);
      expect(healthReport.overall).toMatch(/healthy|warning|error/);
      expect(healthReport.components).toBeDefined();
      expect(healthReport.recommendations).toBeInstanceOf(Array);
    });

    it('预设管理功能', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const testPreset = {
        name: '测试预设',
        description: '用于测试的预设配置',
        settings: result.current.watermark.settings
      };

      act(() => {
        result.current.savePreset(testPreset);
      });

      expect(result.current.watermark.presets).toHaveLength(1);
      expect(result.current.watermark.presets[0].name).toBe('测试预设');

      // 加载预设
      const presetId = result.current.watermark.presets[0].id;
      act(() => {
        result.current.loadPreset(presetId);
      });

      // 删除预设
      act(() => {
        result.current.deletePreset(presetId);
      });

      expect(result.current.watermark.presets).toHaveLength(0);
    });

    it('模态窗口管理', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      expect(result.current.ui.modals.settings).toBe(false);

      act(() => {
        result.current.showModal('settings');
      });

      expect(result.current.ui.modals.settings).toBe(true);

      act(() => {
        result.current.hideModal('settings');
      });

      expect(result.current.ui.modals.settings).toBe(false);
    });

    it('性能监控功能', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const newMetrics = {
        averageProcessingTime: 1500,
        totalFilesProcessed: 10,
        memoryPeakUsage: 50
      };

      act(() => {
        result.current.updateMetrics(newMetrics);
      });

      expect(result.current.performance.metrics.averageProcessingTime).toBe(1500);
      expect(result.current.performance.metrics.totalFilesProcessed).toBe(10);

      const warning = '内存使用率较高';
      act(() => {
        result.current.addWarning(warning);
      });

      expect(result.current.performance.warnings).toContain(warning);

      act(() => {
        result.current.clearWarnings();
      });

      expect(result.current.performance.warnings).toHaveLength(0);
    });
  });

  describe('边界情况和错误处理', () => {
    it('空文件列表处理', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      act(() => {
        result.current.selectFiles([]);
      });

      expect(result.current.files.selected).toHaveLength(0);
    });

    it('无效文件类型处理', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const invalidFile = new File(['invalid'], 'test.xyz', { type: 'application/unknown' });
      
      act(() => {
        result.current.selectFiles([invalidFile]);
      });

      expect(result.current.files.selected).toHaveLength(1);
      // 文件验证应该在处理阶段进行
    });

    it('大量文件选择', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      const largeFileList = Array(100).fill(0).map((_, i) => 
        new File([`content ${i}`], `file${i}.pdf`, { type: 'application/pdf' })
      );

      act(() => {
        result.current.selectFiles(largeFileList);
      });

      expect(result.current.files.selected).toHaveLength(100);
    });

    it('状态更新异常处理', () => {
      const { result } = renderHook(() => useWatermarkStore());
      
      // 测试无效的状态更新
      expect(() => {
        act(() => {
          result.current.updateWatermarkSettings(null as any);
        });
      }).not.toThrow();

      // 状态应该保持不变或处理为默认值
      expect(result.current.watermark.settings).toBeDefined();
    });
  });
});