/**
 * 完整文档处理流程 - 集成测试
 * 测试用例覆盖：INT-001~035
 * 包含：PDF水印流程、Word转PDF流程、中文水印处理、错误恢复流程
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { LibraryLoader } from '../../utils/cdn/LibraryLoader';
import { PDFWatermarkEngine } from '../../engines/pdf/PDFWatermarkEngine';
import type { WatermarkSettings } from '../../types/watermark.types';

// Mock browser APIs
global.performance = {
  now: vi.fn(() => Date.now())
} as any;

global.document = {
  createElement: vi.fn(() => ({
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      font: '',
      fillStyle: '',
      measureText: vi.fn(() => ({ width: 100 })),
      fillText: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      textAlign: 'center',
      textBaseline: 'middle'
    })),
    toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='),
    toBlob: vi.fn((callback) => {
      callback(new Blob(['fake-png'], { type: 'image/png' }));
    })
  })),
  head: {
    appendChild: vi.fn()
  }
} as any;

global.window = {
  PDFLib: {
    PDFDocument: {
      create: vi.fn(() => Promise.resolve({
        addPage: vi.fn(() => ({
          getSize: vi.fn(() => ({ width: 595, height: 842 })),
          drawText: vi.fn(),
          drawImage: vi.fn()
        })),
        getPageCount: vi.fn(() => 1),
        getPages: vi.fn(() => []),
        save: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3, 4]))),
        embedPng: vi.fn(() => Promise.resolve({
          scale: vi.fn(() => ({ width: 100, height: 50 }))
        })),
        registerFontkit: vi.fn()
      })),
      load: vi.fn(() => Promise.resolve({
        getPageCount: vi.fn(() => 2),
        getPages: vi.fn(() => [
          { getSize: vi.fn(() => ({ width: 595, height: 842 })), drawText: vi.fn(), drawImage: vi.fn() },
          { getSize: vi.fn(() => ({ width: 595, height: 842 })), drawText: vi.fn(), drawImage: vi.fn() }
        ]),
        save: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3, 4, 5, 6]))),
        embedPng: vi.fn(() => Promise.resolve({
          scale: vi.fn(() => ({ width: 100, height: 50 }))
        }))
      }))
    },
    rgb: vi.fn((r, g, b) => ({ r, g, b }))
  },
  JSZip: vi.fn(() => ({
    loadAsync: vi.fn(() => Promise.resolve({
      files: {
        'word/document.xml': {
          async: vi.fn(() => Promise.resolve('<xml>document content</xml>'))
        }
      }
    }))
  })),
  mammoth: {
    extractRawText: vi.fn(() => Promise.resolve({
      value: '这是从Word文档中提取的中文内容测试',
      messages: []
    }))
  },
  fontkit: {}
} as any;

describe('DocumentProcessing Integration Tests - 文档处理流程集成测试', () => {
  const mockPDFFile = new File([new ArrayBuffer(1000)], 'test.pdf', { type: 'application/pdf' });
  const mockWordFile = new File([new ArrayBuffer(2000)], 'test.docx', { 
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  });
  const mockImageFile = new File([new ArrayBuffer(500)], 'test.jpg', { type: 'image/jpeg' });

  const defaultWatermarkSettings: WatermarkSettings = {
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
        stagger: true,
        layers: 1,
        densityMode: 'normal'
      },
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      blendMode: 'source-over'
    },
    security: {
      generateCertificate: false,
      hashAlgorithm: 'SHA-256',
      embedMetadata: true,
      tamperProtection: false,
      blockChineseCharacters: false
    },
    output: {
      format: 'png',
      quality: 0.9,
      preserveOriginalMetadata: false,
      compression: {
        enabled: true,
        level: 'medium'
      }
    }
  };

  beforeAll(async () => {
    // 初始化测试环境
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    // 重置store状态
    store = useWatermarkStore.getState();
    useWatermarkStore.setState({
      cdn: { initialized: false, loadedLibraries: new Set(), loadingProgress: new Map(), stats: {}, healthMetrics: {} },
      canvas: { 
        engine: null, 
        context: null, 
        pool: {} as any, // Mock pool object
        activeCanvases: new Set(),
        chineseRenderer: { initialized: false, optimalFont: null, renderQuality: 'high', supportedFeatures: [] }
      },
      pdfEngine: { initialized: false, status: 'ready', supportedFeatures: [], lastError: null },
      files: { 
        selected: [], 
        processing: new Map(), 
        results: new Map(),
        statistics: { totalProcessed: 0, successCount: 0, errorCount: 0, averageProcessingTime: 0, chineseContentDetected: 0 }
      },
      ui: { loading: false, error: null, progress: null, activeView: 'upload', modals: { settings: false, help: false, error: false, certificate: false, presets: false } }
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('A. 完整文档处理流程 (35用例)', () => {
    it('INT-001: PDF水印完整流程', async () => {
      const store = useWatermarkStore.getState();
      
      // 1. 系统初始化
      await store.initializeSystem();
      expect(store.cdn.initialized).toBe(true);
      expect(store.pdfEngine.initialized).toBe(true);

      // 2. 选择文件
      store.selectFiles([mockPDFFile]);
      expect(store.files.selected).toHaveLength(1);

      // 3. 处理文件
      await store.processFiles(defaultWatermarkSettings);
      
      // 4. 验证结果
      expect(store.files.results.size).toBe(1);
      const result = store.files.results.get(`${mockPDFFile.name}-${mockPDFFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.processedImage.format).toBe('pdf');
      expect(result!.metadata?.enhancedEngine).toBe(true);

      // 5. 验证统计信息
      expect(store.files.statistics.totalProcessed).toBe(1);
      expect(store.files.statistics.successCount).toBe(1);
      expect(store.files.statistics.chineseContentDetected).toBe(1);
    });

    it('INT-002: Word转PDF完整流程', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      store.selectFiles([mockWordFile]);

      const wordToPdfSettings = {
        ...defaultWatermarkSettings,
        output: { ...defaultWatermarkSettings.output, format: 'png' as const }
      };

      await store.processFiles(wordToPdfSettings);
      
      const result = store.files.results.get(`${mockWordFile.name}-${mockWordFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.processedImage.format).toBe('pdf');
      expect(result!.metadata?.conversionMethod).toBe('word-to-pdf-enhanced');
    });

    it('INT-003: 中文水印PDF流程', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      
      const chineseSettings = {
        ...defaultWatermarkSettings,
        text: {
          ...defaultWatermarkSettings.text!,
          content: '绝密资料请勿外传'
        }
      };

      store.selectFiles([mockPDFFile]);
      await store.processFiles(chineseSettings);
      
      const result = store.files.results.get(`${mockPDFFile.name}-${mockPDFFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(store.files.statistics.chineseContentDetected).toBe(1);
    });

    it('INT-004: 网格水印生成流程', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      
      const gridSettings = {
        ...defaultWatermarkSettings,
        position: {
          ...defaultWatermarkSettings.position,
          placement: 'grid' as const,
          grid: {
            spacingX: 200,
            spacingY: 150,
            stagger: true,
            layers: 2,
            densityMode: 'normal' as const
          },
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          blendMode: 'source-over',
          opacity: 0.3,
          scale: 1.0,
          rotation: 0
        }
      };

      store.selectFiles([mockPDFFile]);
      await store.processFiles(gridSettings);
      
      const result = store.files.results.get(`${mockPDFFile.name}-${mockPDFFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.metadata?.watermarkCount).toBeGreaterThan(1); // 网格应产生多个水印
    });

    it('INT-005: 大文件处理流程', async () => {
      const store = useWatermarkStore.getState();
      
      // 创建大文件模拟
      const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 10 * 1024 * 1024 });

      await store.initializeSystem();
      store.selectFiles([largeFile]);

      const startTime = performance.now();
      await store.processFiles(defaultWatermarkSettings);
      const processingTime = performance.now() - startTime;

      const result = store.files.results.get(`${largeFile.name}-${largeFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(processingTime).toBeLessThan(30000); // 30秒内完成
    });

    it('INT-006: 批量文件处理', async () => {
      const store = useWatermarkStore.getState();
      
      const files = [mockPDFFile, mockWordFile, mockImageFile];
      
      await store.initializeSystem();
      store.selectFiles(files);

      await store.processFiles(defaultWatermarkSettings);
      
      expect(store.files.results.size).toBe(3);
      expect(store.files.statistics.totalProcessed).toBe(3);
      
      // 验证每个文件都有结果
      files.forEach(file => {
        const result = store.files.results.get(`${file.name}-${file.size}`);
        expect(result).toBeDefined();
      });
    });

    it('INT-007: 错误恢复完整流程', async () => {
      const store = useWatermarkStore.getState();
      
      // 模拟初始化失败
      vi.mocked(PDFWatermarkEngine.initialize).mockRejectedValueOnce(new Error('Initialization failed'));
      
      try {
        await store.initializeSystem();
      } catch (error) {
        expect(error).toBeDefined();
      }

      expect(store.ui.error).toBeDefined();
      expect(store.ui.error!.code).toBe('SYSTEM_INIT_FAILED');
      expect(store.pdfEngine.status).toBe('error');
      
      // 错误恢复
      vi.mocked(PDFWatermarkEngine.initialize).mockResolvedValueOnce(undefined);
      await store.initializeSystem();
      
      expect(store.pdfEngine.initialized).toBe(true);
      expect(store.ui.error).toBeNull();
    });

    it('INT-008: 取消操作流程', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      store.selectFiles([mockPDFFile]);

      // 开始处理
      const processingPromise = store.processFiles(defaultWatermarkSettings);
      
      // 模拟用户取消
      store.clearFiles();
      
      expect(store.files.selected).toHaveLength(0);
      expect(store.ui.activeView).toBe('upload');
      
      // 等待处理完成
      await processingPromise.catch(() => {}); // 可能会因为取消而失败
    });

    it('INT-009: 多格式混合处理', async () => {
      const store = useWatermarkStore.getState();
      
      const mixedFiles = [
        mockPDFFile,
        mockWordFile, 
        new File([new ArrayBuffer(800)], 'test.png', { type: 'image/png' }),
        new File([new ArrayBuffer(1200)], 'test.doc', { type: 'application/msword' })
      ];

      await store.initializeSystem();
      store.selectFiles(mixedFiles);

      await store.processFiles(defaultWatermarkSettings);
      
      expect(store.files.results.size).toBe(4);
      
      // 验证不同格式都有适当处理
      const pdfResult = store.files.results.get(`${mockPDFFile.name}-${mockPDFFile.size}`);
      const wordResult = store.files.results.get(`${mockWordFile.name}-${mockWordFile.size}`);
      
      expect(pdfResult!.metadata?.enhancedEngine).toBe(true);
      expect(wordResult!.metadata?.conversionMethod).toBeDefined();
    });

    it('INT-010: 处理超时流程', async () => {
      const store = useWatermarkStore.getState();
      
      // 模拟处理超时
      vi.mocked(global.window.PDFLib.PDFDocument.load).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 30000)) // 30秒超时
      );

      await store.initializeSystem();
      store.selectFiles([mockPDFFile]);

      const startTime = Date.now();
      await store.processFiles(defaultWatermarkSettings);
      const endTime = Date.now();

      // 应该在合理时间内完成或失败
      expect(endTime - startTime).toBeLessThan(10000); // 10秒内
    });

    it('INT-011: 内存限制处理', async () => {
      const store = useWatermarkStore.getState();
      
      // 创建多个大文件
      const largeFiles = Array(5).fill(0).map((_, i) => 
        new File([new ArrayBuffer(5 * 1024 * 1024)], `large${i}.pdf`, { type: 'application/pdf' })
      );

      await store.initializeSystem();
      store.selectFiles(largeFiles);

      await store.processFiles(defaultWatermarkSettings);
      
      // 验证内存管理
      expect(store.files.statistics.totalProcessed).toBe(5);
      expect(store.performance.metrics.memoryPeakUsage).toBeGreaterThan(0);
    });

    it('INT-012: 网络中断恢复', async () => {
      const store = useWatermarkStore.getState();
      
      // 模拟网络中断
      let networkAvailable = false;
      vi.mocked(LibraryLoader.loadLibrary).mockImplementation((name) => {
        if (!networkAvailable) {
          return Promise.reject(new Error('Network unavailable'));
        }
        return Promise.resolve({
          success: true,
          library: name,
          loadTime: 100,
          method: 'network'
        });
      });

      // 首次初始化失败
      try {
        await store.initializeSystem();
      } catch (error) {
        expect(error).toBeDefined();
      }

      // 网络恢复
      networkAvailable = true;
      await store.initializeSystem();
      
      expect(store.cdn.initialized).toBe(true);
    });

    it('INT-013: 文件损坏处理', async () => {
      const store = useWatermarkStore.getState();
      
      // 创建损坏的文件
      const corruptedFile = new File([new ArrayBuffer(10)], 'corrupted.pdf', { type: 'application/pdf' });
      
      // 模拟PDF加载失败
      vi.mocked(global.window.PDFLib.PDFDocument.load).mockRejectedValueOnce(new Error('Invalid PDF'));

      await store.initializeSystem();
      store.selectFiles([corruptedFile]);

      await store.processFiles(defaultWatermarkSettings);
      
      const result = store.files.results.get(`${corruptedFile.name}-${corruptedFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error).toBeDefined();
      expect(store.files.statistics.errorCount).toBe(1);
    });

    it('INT-014: 空文件处理流程', async () => {
      const store = useWatermarkStore.getState();
      
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      
      await store.initializeSystem();
      store.selectFiles([emptyFile]);

      await store.processFiles(defaultWatermarkSettings);
      
      const result = store.files.results.get(`${emptyFile.name}-${emptyFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error?.message).toContain('empty');
    });

    it('INT-015: 加密文件处理', async () => {
      const store = useWatermarkStore.getState();
      
      const encryptedFile = new File([new ArrayBuffer(1000)], 'encrypted.pdf', { type: 'application/pdf' });
      
      // 模拟加密PDF
      vi.mocked(global.window.PDFLib.PDFDocument.load).mockRejectedValueOnce(new Error('Password required'));

      await store.initializeSystem();
      store.selectFiles([encryptedFile]);

      await store.processFiles(defaultWatermarkSettings);
      
      const result = store.files.results.get(`${encryptedFile.name}-${encryptedFile.size}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error?.message).toContain('Password');
    });
  });

  describe('B. 性能和质量验证', () => {
    it('INT-031: 格式转换精度', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      store.selectFiles([mockWordFile]);

      await store.processFiles(defaultWatermarkSettings);
      
      const result = store.files.results.get(`${mockWordFile.name}-${mockWordFile.size}`);
      expect(result!.success).toBe(true);
      expect(result!.processedImage.size).toBeGreaterThan(0);
      expect(result!.metadata?.compressionRatio).toBeGreaterThan(0);
    });

    it('INT-032: 处理质量验证', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      store.selectFiles([mockPDFFile]);

      const highQualitySettings = {
        ...defaultWatermarkSettings,
        output: {
          ...defaultWatermarkSettings.output,
          quality: 0.95
        }
      };

      await store.processFiles(highQualitySettings);
      
      const result = store.files.results.get(`${mockPDFFile.name}-${mockPDFFile.size}`);
      expect(result!.success).toBe(true);
      expect(result!.metadata?.version).toContain('enhanced');
    });

    it('INT-033: 输出文件完整性', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      store.selectFiles([mockPDFFile]);

      await store.processFiles(defaultWatermarkSettings);
      
      const result = store.files.results.get(`${mockPDFFile.name}-${mockPDFFile.size}`);
      expect(result!.success).toBe(true);
      expect(result!.processedImage.blob.size).toBeGreaterThan(0);
      expect(result!.processedImage.dataUrl).toContain('data:');
      expect(result!.processedImage.format).toBe('pdf');
    });

    it('INT-034: 水印位置精度', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      
      const preciseSettings = {
        ...defaultWatermarkSettings,
        position: {
          ...defaultWatermarkSettings.position,
          grid: {
            spacingX: 200,
            spacingY: 150,
            stagger: false, // 精确对齐
            layers: 1,
            densityMode: 'normal' as const
          }
        }
      };

      store.selectFiles([mockPDFFile]);
      await store.processFiles(preciseSettings);
      
      const result = store.files.results.get(`${mockPDFFile.name}-${mockPDFFile.size}`);
      expect(result!.success).toBe(true);
      expect(result!.metadata?.watermarkCount).toBeGreaterThan(0);
    });

    it('INT-035: 最终质量检查', async () => {
      const store = useWatermarkStore.getState();
      
      await store.initializeSystem();
      store.selectFiles([mockPDFFile, mockWordFile]);

      await store.processFiles(defaultWatermarkSettings);
      
      // 系统健康检查
      const healthReport = await store.performHealthCheck();
      expect(healthReport.overall).not.toBe('error');
      
      // 统计验证
      expect(store.files.statistics.totalProcessed).toBe(2);
      expect(store.files.statistics.successCount).toBeGreaterThan(0);
      
      // 性能指标验证
      expect(store.files.statistics.averageProcessingTime).toBeGreaterThan(0);
      
      // CDN状态验证
      const cdnStatus = store.getCDNStatus();
      expect(cdnStatus.initialized).toBe(true);
      
      // 引擎状态验证
      const engineStatus = store.getEngineStatus();
      expect(engineStatus.pdfEngine.initialized).toBe(true);
      expect(engineStatus.canvas.initialized).toBe(true);
    });
  });
});