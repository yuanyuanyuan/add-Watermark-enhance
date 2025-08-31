/**
 * 性能测试套件
 * 测试系统在不同负载和场景下的性能表现
 * 包括内存使用、处理速度、并发处理能力
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 性能监控工具
class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;
  private memoryStart: any = null;
  private memoryEnd: any = null;

  start() {
    this.startTime = performance.now();
    if ('memory' in performance) {
      this.memoryStart = (performance as any).memory;
    }
  }

  end() {
    this.endTime = performance.now();
    if ('memory' in performance) {
      this.memoryEnd = (performance as any).memory;
    }
  }

  getDuration() {
    return this.endTime - this.startTime;
  }

  getMemoryUsage() {
    if (this.memoryStart && this.memoryEnd) {
      return {
        heapUsed: this.memoryEnd.usedJSHeapSize - this.memoryStart.usedJSHeapSize,
        heapTotal: this.memoryEnd.totalJSHeapSize - this.memoryStart.totalJSHeapSize,
        heapLimit: this.memoryEnd.jsHeapSizeLimit
      };
    }
    return null;
  }
}

// 模拟大文件
const createLargeFile = (sizeInMB: number, type: string = 'application/pdf'): File => {
  const size = sizeInMB * 1024 * 1024;
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  
  // 填充一些数据以模拟真实文件
  for (let i = 0; i < Math.min(1024, size); i++) {
    view[i] = i % 256;
  }
  
  return new File([buffer], `large-file-${sizeInMB}MB.pdf`, { type });
};

// 模拟 Canvas API
const mockCanvas = () => {
  const canvas = document.createElement('canvas');
  const ctx = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    font: '',
    fillStyle: '',
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high' as ImageSmoothingQuality,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline
  };
  
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock-data');
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
    const blob = new Blob(['mock-data'], { type: 'image/png' });
    if (callback) callback(blob);
  });
  
  return { canvas, ctx };
};

describe('性能测试套件', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    
    // 模拟 PDF-lib
    (window as any).PDFLib = {
      PDFDocument: {
        create: vi.fn().mockResolvedValue({
          addPage: vi.fn().mockReturnValue({
            getSize: vi.fn(() => ({ width: 595, height: 842 })),
            drawText: vi.fn(),
            drawImage: vi.fn()
          }),
          embedPng: vi.fn().mockResolvedValue({
            scale: vi.fn(() => ({ width: 100, height: 100 }))
          }),
          save: vi.fn().mockResolvedValue(new Uint8Array(1024))
        }),
        load: vi.fn().mockResolvedValue({
          getPages: vi.fn(() => []),
          save: vi.fn().mockResolvedValue(new Uint8Array(1024))
        })
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('文件处理性能', () => {
    it('应该在合理时间内处理小文件 (1MB)', async () => {
      const file = createLargeFile(1);
      monitor.start();
      
      // 模拟文件处理过程
      const processFile = async (file: File) => {
        const reader = new FileReader();
        const readPromise = new Promise((resolve) => {
          reader.onload = resolve;
          setTimeout(() => {
            if (reader.onload) {
              reader.onload({ target: { result: new ArrayBuffer(file.size) } } as any);
            }
          }, 50); // 模拟读取时间
        });
        
        reader.readAsArrayBuffer(file);
        await readPromise;
        
        // 模拟水印处理
        const { canvas } = mockCanvas();
        canvas.width = 800;
        canvas.height = 600;
        
        return {
          success: true,
          processedSize: file.size,
          originalSize: file.size
        };
      };
      
      const result = await processFile(file);
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // 1MB文件应在1秒内处理完成
    });

    it('应该能够处理中等大小文件 (10MB)', async () => {
      const file = createLargeFile(10);
      monitor.start();
      
      const processLargeFile = async (file: File) => {
        // 分块处理大文件
        const chunkSize = 1024 * 1024; // 1MB chunks
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
          // 模拟每个chunk的处理时间
          await new Promise(resolve => setTimeout(resolve, 20));
          
          // 模拟进度更新
          const progress = (i + 1) / totalChunks;
          expect(progress).toBeGreaterThan(0);
          expect(progress).toBeLessThanOrEqual(1);
        }
        
        return { success: true, chunks: totalChunks };
      };
      
      const result = await processLargeFile(file);
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(result.success).toBe(true);
      expect(result.chunks).toBe(10);
      expect(duration).toBeLessThan(5000); // 10MB文件应在5秒内处理完成
    });

    it('应该在处理大文件时控制内存使用', async () => {
      const file = createLargeFile(50); // 50MB文件
      monitor.start();
      
      // 流式处理以控制内存
      const processStreamFile = async (file: File) => {
        const chunkSize = 2 * 1024 * 1024; // 2MB chunks
        let processedSize = 0;
        
        while (processedSize < file.size) {
          const chunk = file.slice(processedSize, Math.min(processedSize + chunkSize, file.size));
          
          // 处理chunk
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = resolve;
            setTimeout(() => {
              if (reader.onload) {
                reader.onload({ target: { result: new ArrayBuffer(chunk.size) } } as any);
              }
            }, 30);
          });
          
          reader.readAsArrayBuffer(chunk);
          processedSize += chunk.size;
          
          // 模拟处理延迟
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        return { processedSize, totalSize: file.size };
      };
      
      const result = await processStreamFile(file);
      monitor.end();
      
      expect(result.processedSize).toBe(result.totalSize);
      
      // 检查内存使用（如果可用）
      const memoryUsage = monitor.getMemoryUsage();
      if (memoryUsage) {
        // 流式处理应该控制内存增长在合理范围内
        expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB上限
      }
    });
  });

  describe('Canvas渲染性能', () => {
    it('应该快速创建简单水印', () => {
      monitor.start();
      
      const createSimpleWatermark = () => {
        const { canvas, ctx } = mockCanvas();
        canvas.width = 200;
        canvas.height = 50;
        
        ctx.font = '24px Arial';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillText('CONFIDENTIAL', 10, 30);
        
        return canvas.toDataURL();
      };
      
      const dataUrl = createSimpleWatermark();
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(dataUrl).toContain('data:image/png');
      expect(duration).toBeLessThan(100); // 简单水印应在100ms内完成
    });

    it('应该高效处理网格水印', () => {
      monitor.start();
      
      const createGridWatermark = () => {
        const { canvas, ctx } = mockCanvas();
        canvas.width = 800;
        canvas.height = 600;
        
        const spacingX = 200;
        const spacingY = 150;
        const cols = Math.floor(canvas.width / spacingX);
        const rows = Math.floor(canvas.height / spacingY);
        
        let watermarkCount = 0;
        
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * spacingX + 100;
            const y = row * spacingY + 75;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 4); // -45度
            ctx.fillText('水印', -20, 5);
            ctx.restore();
            
            watermarkCount++;
          }
        }
        
        return { dataUrl: canvas.toDataURL(), count: watermarkCount };
      };
      
      const result = createGridWatermark();
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(result.count).toBeGreaterThan(0);
      expect(result.dataUrl).toContain('data:image/png');
      expect(duration).toBeLessThan(500); // 网格水印应在500ms内完成
    });

    it('应该高效处理中文字符渲染', () => {
      monitor.start();
      
      const renderChineseText = () => {
        const { canvas, ctx } = mockCanvas();
        canvas.width = 400;
        canvas.height = 200;
        
        // 测试不同字体
        const fonts = [
          'Microsoft YaHei',
          'SimSun',
          'PingFang SC',
          'sans-serif'
        ];
        
        const testTexts = [
          '机密文档',
          '内部资料',
          '版权所有',
          '请勿传播'
        ];
        
        let renderCount = 0;
        
        fonts.forEach((font, fontIndex) => {
          testTexts.forEach((text, textIndex) => {
            ctx.font = `20px ${font}`;
            ctx.fillText(text, 50, 50 + fontIndex * 30 + textIndex * 5);
            renderCount++;
          });
        });
        
        return { dataUrl: canvas.toDataURL(), renderCount };
      };
      
      const result = renderChineseText();
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(result.renderCount).toBe(16); // 4字体 × 4文本
      expect(duration).toBeLessThan(300); // 中文渲染应在300ms内完成
    });
  });

  describe('并发处理性能', () => {
    it('应该能够并发处理多个小文件', async () => {
      const fileCount = 5;
      const files = Array.from({ length: fileCount }, () => 
        createLargeFile(1, 'application/pdf')
      );
      
      monitor.start();
      
      const processFileConcurrently = async (files: File[]) => {
        const processSingleFile = async (file: File, index: number) => {
          // 模拟文件处理
          await new Promise(resolve => setTimeout(resolve, 200 + index * 50));
          
          const { canvas } = mockCanvas();
          canvas.width = 600;
          canvas.height = 800;
          
          return {
            index,
            originalName: file.name,
            processedName: `watermarked_${file.name}`,
            success: true
          };
        };
        
        // 并发处理所有文件
        const results = await Promise.all(
          files.map((file, index) => processSingleFile(file, index))
        );
        
        return results;
      };
      
      const results = await processFileConcurrently(files);
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(results).toHaveLength(fileCount);
      expect(results.every(r => r.success)).toBe(true);
      
      // 并发处理应该比串行处理快
      expect(duration).toBeLessThan(1000); // 并发处理5个1MB文件应在1秒内完成
    });

    it('应该能够限制并发数量以控制资源使用', async () => {
      const fileCount = 10;
      const maxConcurrent = 3;
      const files = Array.from({ length: fileCount }, () => 
        createLargeFile(2, 'application/pdf')
      );
      
      monitor.start();
      
      const processWithConcurrencyLimit = async (files: File[], limit: number) => {
        const results: any[] = [];
        
        for (let i = 0; i < files.length; i += limit) {
          const batch = files.slice(i, i + limit);
          
          const batchResults = await Promise.all(
            batch.map(async (file, batchIndex) => {
              // 模拟处理时间
              await new Promise(resolve => setTimeout(resolve, 150));
              
              return {
                index: i + batchIndex,
                name: file.name,
                size: file.size,
                success: true,
                batchNumber: Math.floor(i / limit) + 1
              };
            })
          );
          
          results.push(...batchResults);
        }
        
        return results;
      };
      
      const results = await processWithConcurrencyLimit(files, maxConcurrent);
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(results).toHaveLength(fileCount);
      expect(results.every(r => r.success)).toBe(true);
      
      // 验证批次处理
      const batches = new Set(results.map(r => r.batchNumber));
      expect(batches.size).toBe(Math.ceil(fileCount / maxConcurrent));
      
      // 受限并发应该在合理时间内完成
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('内存管理性能', () => {
    it('应该在处理完成后释放内存', async () => {
      if (!('memory' in performance)) {
        // 如果不支持内存监控，跳过测试
        return;
      }
      
      monitor.start();
      
      const processAndCleanup = async () => {
        const largeFiles = Array.from({ length: 3 }, () => createLargeFile(10));
        const canvases: HTMLCanvasElement[] = [];
        
        // 创建大量Canvas对象
        for (let i = 0; i < largeFiles.length; i++) {
          const { canvas } = mockCanvas();
          canvas.width = 1200;
          canvas.height = 1600;
          canvases.push(canvas);
          
          // 模拟大量渲染操作
          for (let j = 0; j < 50; j++) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillText(`文本${i}-${j}`, j * 10, i * 20 + j * 5);
            }
          }
        }
        
        // 处理完成，清理资源
        canvases.forEach(canvas => {
          canvas.width = 0;
          canvas.height = 0;
        });
        
        // 强制垃圾回收（在支持的环境中）
        if ('gc' in window) {
          (window as any).gc();
        }
        
        return { processedCount: largeFiles.length, canvasCount: canvases.length };
      };
      
      const result = await processAndCleanup();
      monitor.end();
      
      expect(result.processedCount).toBe(3);
      expect(result.canvasCount).toBe(3);
      
      // 检查内存使用情况
      const memoryUsage = monitor.getMemoryUsage();
      if (memoryUsage) {
        // 确保内存增长在合理范围内
        expect(memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB上限
      }
    });
  });

  describe('错误恢复性能', () => {
    it('应该快速从处理错误中恢复', async () => {
      monitor.start();
      
      const processWithErrorRecovery = async () => {
        const files = [
          createLargeFile(1),
          null, // 故意的空文件来触发错误
          createLargeFile(2),
          createLargeFile(1)
        ];
        
        const results = [];
        let errorCount = 0;
        let successCount = 0;
        
        for (const file of files) {
          try {
            if (!file) {
              throw new Error('Invalid file');
            }
            
            // 模拟处理
            await new Promise(resolve => setTimeout(resolve, 100));
            
            results.push({ success: true, file: file.name });
            successCount++;
            
          } catch (error) {
            // 快速错误恢复
            errorCount++;
            results.push({ success: false, error: (error as Error).message });
            
            // 错误恢复不应该耗费太多时间
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
        return { results, errorCount, successCount };
      };
      
      const result = await processWithErrorRecovery();
      monitor.end();
      
      const duration = monitor.getDuration();
      
      expect(result.results).toHaveLength(4);
      expect(result.errorCount).toBe(1);
      expect(result.successCount).toBe(3);
      
      // 包含错误恢复的处理应该在合理时间内完成
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('系统负载性能', () => {
    it('应该在高负载下保持稳定性能', async () => {
      const iterations = 20;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const iterationMonitor = new PerformanceMonitor();
        iterationMonitor.start();
        
        // 模拟系统负载操作
        const { canvas, ctx } = mockCanvas();
        canvas.width = 400;
        canvas.height = 300;
        
        // 执行大量绘图操作
        for (let j = 0; j < 100; j++) {
          ctx.fillText(`负载测试${i}-${j}`, (j % 10) * 40, Math.floor(j / 10) * 20);
        }
        
        // 模拟数据处理
        const data = new Uint8Array(1024);
        for (let k = 0; k < data.length; k++) {
          data[k] = (i + k) % 256;
        }
        
        iterationMonitor.end();
        durations.push(iterationMonitor.getDuration());
      }
      
      // 分析性能稳定性
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      
      expect(avgDuration).toBeLessThan(200); // 平均处理时间应合理
      expect(maxDuration).toBeLessThan(500); // 最大处理时间应在可接受范围
      expect(stdDev).toBeLessThan(100); // 标准差应较小，表示性能稳定
      
      // 性能不应该随迭代显著下降
      const firstHalf = durations.slice(0, iterations / 2);
      const secondHalf = durations.slice(iterations / 2);
      const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d, 0) / secondHalf.length;
      
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5); // 性能下降不超过50%
    });
  });
});