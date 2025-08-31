/**
 * 图像处理 WebWorker
 * 专门处理图像优化、格式转换等任务
 * 基于架构文档的 WebWorker 设计
 */

import type {
  WorkerMessage,
  ProcessingTask,
  TaskResult,
  ProcessingMetrics
} from '@/types/worker.types';

declare const self: DedicatedWorkerGlobalScope;

class ImageProcessor {
  private _isProcessing = false;
  // private _currentTaskId: string | null = null; // Unused variable

  constructor() {
    self.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.handleMessage(event.data);
    };

    console.log('Image processor worker initialized');
  }

  private async handleMessage(message: WorkerMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'task':
          await this.processTask(message.taskId, message.data as ProcessingTask);
          break;
        default:
          this.sendError(message.taskId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(message.taskId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async processTask(taskId: string, task: ProcessingTask): Promise<void> {
    if (this._isProcessing) {
      this.sendError(taskId, 'Worker is already processing a task');
      return;
    }

    this._isProcessing = true;
    // this._currentTaskId = taskId; // Task tracking disabled

    const startTime = performance.now();
    const startMemory = this.estimateMemoryUsage();

    try {
      let result: any;

      switch (task.type) {
        case 'resize':
          result = await this.resizeImage(taskId, task);
          break;
        case 'format-convert':
          result = await this.convertFormat(taskId, task);
          break;
        case 'optimize':
          result = await this.optimizeImage(taskId, task);
          break;
        case 'filter':
          result = await this.applyFilter(taskId, task);
          break;
        default:
          throw new Error(`Unsupported image processing type: ${task.type}`);
      }

      const metrics: ProcessingMetrics = {
        processingTime: performance.now() - startTime,
        memoryUsage: this.estimateMemoryUsage() - startMemory,
        operationCount: 1,
        compressionRatio: result.compressionRatio || 1
      };

      this.sendResult(taskId, {
        taskId,
        success: true,
        data: result,
        metrics
      });
    } catch (error) {
      this.sendError(taskId, error instanceof Error ? error.message : 'Image processing failed');
    } finally {
      this._isProcessing = false;
      // this._currentTaskId = null; // Task tracking disabled
    }
  }

  private async resizeImage(taskId: string, task: ProcessingTask): Promise<any> {
    const { imageData, options } = task.data;
    const { width: targetWidth, height: targetHeight } = options.targetSize || {};
    
    if (!imageData || !targetWidth || !targetHeight) {
      throw new Error('Missing image data or target dimensions');
    }

    this.sendProgress(taskId, 0.1);

    const originalCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const originalCtx = originalCanvas.getContext('2d');
    
    if (!originalCtx) {
      throw new Error('Failed to get original canvas context');
    }

    originalCtx.putImageData(imageData, 0, 0);
    
    this.sendProgress(taskId, 0.3);

    // 创建目标 Canvas
    const targetCanvas = new OffscreenCanvas(targetWidth, targetHeight);
    const targetCtx = targetCanvas.getContext('2d');
    
    if (!targetCtx) {
      throw new Error('Failed to get target canvas context');
    }

    // 设置高质量缩放
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = 'high';

    // 执行缩放
    targetCtx.drawImage(originalCanvas, 0, 0, targetWidth, targetHeight);
    
    this.sendProgress(taskId, 0.7);

    const outputBlob = await targetCanvas.convertToBlob({
      type: `image/${options.format || 'png'}`,
      quality: options.quality || 0.9
    });

    this.sendProgress(taskId, 1.0);

    return {
      blob: outputBlob,
      dimensions: { width: targetWidth, height: targetHeight },
      originalDimensions: { width: imageData.width, height: imageData.height },
      format: options.format || 'png',
      sizeReduction: imageData.data.length / outputBlob.size
    };
  }

  private async convertFormat(taskId: string, task: ProcessingTask): Promise<any> {
    const { imageData, options } = task.data;
    const { targetFormat, quality } = options;
    
    if (!imageData || !targetFormat) {
      throw new Error('Missing image data or target format');
    }

    this.sendProgress(taskId, 0.2);

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    
    this.sendProgress(taskId, 0.6);

    const outputBlob = await canvas.convertToBlob({
      type: `image/${targetFormat}`,
      quality: quality || 0.9
    });

    this.sendProgress(taskId, 1.0);

    return {
      blob: outputBlob,
      dimensions: { width: imageData.width, height: imageData.height },
      format: targetFormat,
      originalSize: imageData.data.length,
      newSize: outputBlob.size,
      compressionRatio: imageData.data.length / outputBlob.size
    };
  }

  private async optimizeImage(taskId: string, task: ProcessingTask): Promise<any> {
    const { imageData, options } = task.data;
    
    if (!imageData) {
      throw new Error('Missing image data');
    }

    this.sendProgress(taskId, 0.1);

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    
    this.sendProgress(taskId, 0.3);

    // 应用优化算法
    await this.applyOptimizations(ctx, canvas, options);
    
    this.sendProgress(taskId, 0.7);

    // 自动选择最佳格式和质量
    const { format, quality } = this.selectOptimalFormat(imageData, options);

    const outputBlob = await canvas.convertToBlob({
      type: `image/${format}`,
      quality
    });

    this.sendProgress(taskId, 1.0);

    const originalSize = imageData.data.length;
    const compressionRatio = originalSize / outputBlob.size;

    return {
      blob: outputBlob,
      dimensions: { width: canvas.width, height: canvas.height },
      format,
      quality,
      originalSize,
      optimizedSize: outputBlob.size,
      compressionRatio,
      savings: ((originalSize - outputBlob.size) / originalSize * 100).toFixed(2) + '%'
    };
  }

  private async applyFilter(taskId: string, task: ProcessingTask): Promise<any> {
    const { imageData, options } = task.data;
    const { filterType, intensity } = options;
    
    if (!imageData || !filterType) {
      throw new Error('Missing image data or filter type');
    }

    this.sendProgress(taskId, 0.2);

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    
    this.sendProgress(taskId, 0.4);

    // 应用滤镜
    await this.applyImageFilter(ctx, canvas, filterType, intensity || 1.0);
    
    this.sendProgress(taskId, 0.8);

    const outputBlob = await canvas.convertToBlob({
      type: `image/${options.format || 'png'}`,
      quality: options.quality || 0.9
    });

    this.sendProgress(taskId, 1.0);

    return {
      blob: outputBlob,
      dimensions: { width: canvas.width, height: canvas.height },
      format: options.format || 'png',
      filter: filterType,
      intensity
    };
  }

  private async applyOptimizations(
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    options: any
  ): Promise<void> {
    // 应用各种优化技术
    if (options.sharpen) {
      await this.applySharpen(ctx, canvas, options.sharpen);
    }

    if (options.denoise) {
      await this.applyDenoise(ctx, canvas, options.denoise);
    }

    if (options.contrastEnhance) {
      await this.enhanceContrast(ctx, canvas, options.contrastEnhance);
    }
  }

  private async applyImageFilter(
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    filterType: string,
    intensity: number
  ): Promise<void> {
    switch (filterType) {
      case 'blur':
        ctx.filter = `blur(${intensity * 5}px)`;
        break;
      case 'brightness':
        ctx.filter = `brightness(${intensity})`;
        break;
      case 'contrast':
        ctx.filter = `contrast(${intensity})`;
        break;
      case 'grayscale':
        ctx.filter = `grayscale(${intensity})`;
        break;
      case 'sepia':
        ctx.filter = `sepia(${intensity})`;
        break;
      case 'saturate':
        ctx.filter = `saturate(${intensity})`;
        break;
      default:
        throw new Error(`Unsupported filter type: ${filterType}`);
    }

    // 应用滤镜
    const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    // 重置滤镜
    ctx.filter = 'none';
  }

  private async applySharpen(
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    intensity: number
  ): Promise<void> {
    // 锐化算法实现（简化）
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // 应用锐化卷积核
    // Sharpening kernel (for future implementation)
    // const sharpenKernel = [
    //   0, -intensity, 0,
    //   -intensity, 1 + 4 * intensity, -intensity,
    //   0, -intensity, 0
    // ];
    
    // 这里应该实现完整的卷积算法
    // 简化实现：轻微增强对比度
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const factor = brightness > 128 ? 1 + intensity * 0.1 : 1 - intensity * 0.1;
      
      data[i] = Math.min(255, data[i] * factor);     // R
      data[i + 1] = Math.min(255, data[i + 1] * factor); // G
      data[i + 2] = Math.min(255, data[i + 2] * factor); // B
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  private async applyDenoise(
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    intensity: number
  ): Promise<void> {
    // 降噪算法（简化：轻微模糊）
    ctx.filter = `blur(${intensity * 0.5}px)`;
    const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    }
    ctx.filter = 'none';
  }

  private async enhanceContrast(
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    intensity: number
  ): Promise<void> {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const factor = intensity * 2; // 对比度增强因子
    const intercept = 128 * (1 - factor);
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * factor + intercept));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor + intercept)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor + intercept)); // B
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  private selectOptimalFormat(imageData: ImageData, options: any): { format: string; quality: number } {
    // 智能格式选择算法
    const hasTransparency = this.hasTransparency(imageData);
    const isPhotographic = this.isPhotographic(imageData);
    
    if (hasTransparency) {
      return { format: 'png', quality: 1.0 };
    } else if (isPhotographic) {
      return { format: 'jpeg', quality: options.quality || 0.85 };
    } else {
      // 简单图形使用 WebP
      return { format: 'webp', quality: options.quality || 0.9 };
    }
  }

  private hasTransparency(imageData: ImageData): boolean {
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
    return false;
  }

  private isPhotographic(imageData: ImageData): boolean {
    // 简化的摄影图像检测
    const data = imageData.data;
    const sampleSize = Math.min(10000, data.length / 4);
    let colorVariance = 0;
    
    for (let i = 0; i < sampleSize * 4; i += 16) {
      const r1 = data[i], g1 = data[i + 1], b1 = data[i + 2];
      const r2 = data[i + 4], g2 = data[i + 5], b2 = data[i + 6];
      
      colorVariance += Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
    }
    
    const avgVariance = colorVariance / (sampleSize * 3);
    return avgVariance > 20; // 阈值可调
  }

  private sendResult(taskId: string, result: TaskResult): void {
    const message: WorkerMessage = {
      type: 'result',
      taskId,
      data: result,
      timestamp: Date.now()
    };
    
    self.postMessage(message);
  }

  private sendProgress(taskId: string, progress: number): void {
    const message: WorkerMessage = {
      type: 'progress',
      taskId,
      data: progress,
      timestamp: Date.now()
    };
    
    self.postMessage(message);
  }

  private sendError(taskId: string, errorMessage: string): void {
    const message: WorkerMessage = {
      type: 'error',
      taskId,
      data: { message: errorMessage },
      timestamp: Date.now()
    };
    
    self.postMessage(message);
  }

  private estimateMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }
}

// 初始化 Worker
new ImageProcessor();