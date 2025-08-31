/**
 * SimpleWatermarkProcessor 单元测试
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { SimpleWatermarkProcessor } from '../SimpleWatermarkProcessor';
import { 
  createMockFile, 
  createMockCanvas, 
  createMockWatermarkSettings, 
  expectWatermarkResult 
} from '../../test-helpers';

// 模拟Canvas API
global.URL = {
  createObjectURL: vi.fn().mockReturnValue('mock-object-url'),
  revokeObjectURL: vi.fn()
} as any;

global.Image = class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 800;
  height = 600;
  
  set src(value: string) {
    // 模拟图片加载成功
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
  
  get src() { return 'mock-image-src'; }
} as any;

// 模拟document.createElement
const originalCreateElement = document.createElement.bind(document);
document.createElement = vi.fn().mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    return createMockCanvas();
  }
  return originalCreateElement(tagName);
});

describe('SimpleWatermarkProcessor', () => {
  let processor: SimpleWatermarkProcessor;
  let mockFile: File;
  let mockSettings: any;

  beforeEach(() => {
    processor = new SimpleWatermarkProcessor();
    mockFile = createMockFile();
    mockSettings = createMockWatermarkSettings();
    vi.clearAllMocks();
  });

  describe('processFile', () => {
    it('should successfully process a file with text watermark', async () => {
      const result = await processor.processFile(mockFile, mockSettings);
      
      expectWatermarkResult(result, true);
      expect(result.originalFile).toBe(mockFile);
      expect(result.processedImage?.format).toBe('png');
    });

    it('should handle different text watermark positions', async () => {
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
      
      for (const corner of positions) {
        const settings = {
          ...mockSettings,
          position: {
            ...mockSettings.position,
            corner
          }
        };
        
        const result = await processor.processFile(mockFile, settings);
        expectWatermarkResult(result, true);
      }
    });

    it('should handle center placement', async () => {
      const settings = {
        ...mockSettings,
        position: {
          ...mockSettings.position,
          placement: 'center' as const
        }
      };
      
      const result = await processor.processFile(mockFile, settings);
      expectWatermarkResult(result, true);
    });

    it('should apply opacity correctly', async () => {
      const settings = {
        ...mockSettings,
        position: {
          ...mockSettings.position,
          opacity: 0.5
        }
      };
      
      const result = await processor.processFile(mockFile, settings);
      expectWatermarkResult(result, true);
    });

    it('should apply scale correctly', async () => {
      const settings = {
        ...mockSettings,
        position: {
          ...mockSettings.position,
          scale: 1.5
        }
      };
      
      const result = await processor.processFile(mockFile, settings);
      expectWatermarkResult(result, true);
    });

    it('should apply rotation', async () => {
      const settings = {
        ...mockSettings,
        position: {
          ...mockSettings.position,
          rotation: 45
        }
      };
      
      const result = await processor.processFile(mockFile, settings);
      expectWatermarkResult(result, true);
    });

    it('should handle different output formats', async () => {
      const formats = ['png', 'jpeg', 'webp'] as const;
      
      for (const format of formats) {
        const settings = {
          ...mockSettings,
          output: {
            ...mockSettings.output,
            format
          }
        };
        
        const result = await processor.processFile(mockFile, settings);
        expectWatermarkResult(result, true);
        expect(result.processedImage?.format).toBe(format);
      }
    });

    it('should handle different quality settings', async () => {
      const qualities = [0.5, 0.8, 1.0];
      
      for (const quality of qualities) {
        const settings = {
          ...mockSettings,
          output: {
            ...mockSettings.output,
            quality
          }
        };
        
        const result = await processor.processFile(mockFile, settings);
        expectWatermarkResult(result, true);
      }
    });

    it('should handle empty text content gracefully', async () => {
      const settings = {
        ...mockSettings,
        text: {
          ...mockSettings.text,
          content: ''
        }
      };
      
      const result = await processor.processFile(mockFile, settings);
      expectWatermarkResult(result, true);
    });

    it('should handle missing text configuration', async () => {
      const settings = {
        ...mockSettings,
        text: undefined
      };
      
      const result = await processor.processFile(mockFile, settings);
      expectWatermarkResult(result, true);
    });

    it('should handle image load failure', async () => {
      // 模拟图片加载失败
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        
        set src(value: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
        
        get src() { return 'mock-image-src'; }
      } as any;
      
      const result = await processor.processFile(mockFile, mockSettings);
      expectWatermarkResult(result, false);
      expect(result.error).toContain('图片加载失败');
    });

    it('should measure processing time', async () => {
      const result = await processor.processFile(mockFile, mockSettings);
      
      expect(result.processingTime).toBeGreaterThan(0);
      expect(typeof result.processingTime).toBe('number');
    });
  });

  describe('performance', () => {
    it('should process files within reasonable time', async () => {
      const startTime = performance.now();
      const result = await processor.processFile(mockFile, mockSettings);
      const endTime = performance.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('should handle multiple files sequentially', async () => {
      const files = [
        createMockFile('test1.jpg'),
        createMockFile('test2.png'),
        createMockFile('test3.webp')
      ];
      
      const results = [];
      
      for (const file of files) {
        const result = await processor.processFile(file, mockSettings);
        results.push(result);
      }
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expectWatermarkResult(result, true);
      });
    });
  });
});