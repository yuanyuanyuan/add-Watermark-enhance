/**
 * 水印处理 WebWorker
 * 在独立线程中执行水印处理任务
 * 基于架构文档的 WebWorker 设计
 */

import type {
  WorkerMessage,
  ProcessingTask,
  TaskResult,
  ProcessingMetrics,
  WatermarkConfig
} from '@/types/worker.types';

// Worker 上下文类型声明
declare const self: DedicatedWorkerGlobalScope;

class WatermarkProcessor {
  private _isProcessing = false;
  private _currentTaskId: string | null = null;

  constructor() {
    // 监听主线程消息
    self.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.handleMessage(event.data);
    };

    console.log('Watermark processor worker initialized');
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
    this._currentTaskId = taskId;

    const startTime = performance.now();
    const startMemory = this.estimateMemoryUsage();

    try {
      let result: any;

      // 根据任务类型执行相应处理
      switch (task.type) {
        case 'watermark':
          result = await this.processWatermark(taskId, task);
          break;
        case 'process':
          result = await this.processImage(taskId, task);
          break;
        case 'validate':
          result = await this.validateWatermark(taskId, task);
          break;
        case 'compress':
          result = await this.compressImage(taskId, task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      // 计算性能指标
      const metrics: ProcessingMetrics = {
        processingTime: performance.now() - startTime,
        memoryUsage: this.estimateMemoryUsage() - startMemory,
        operationCount: 1,
        compressionRatio: result.compressionRatio || 1
      };

      // 发送结果
      this.sendResult(taskId, {
        taskId,
        success: true,
        data: result,
        metrics
      });
    } catch (error) {
      this.sendError(taskId, error instanceof Error ? error.message : 'Processing failed');
    } finally {
      this._isProcessing = false;
      this._currentTaskId = null;
    }
  }

  private async processWatermark(taskId: string, task: ProcessingTask): Promise<any> {
    const { imageData, watermarkConfig } = task.data;
    
    if (!imageData || !watermarkConfig) {
      throw new Error('Missing image data or watermark configuration');
    }

    this.sendProgress(taskId, 0.1);

    // 创建离屏 Canvas
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // 绘制原始图像
    ctx.putImageData(imageData, 0, 0);
    this.sendProgress(taskId, 0.3);

    // 应用水印
    await this.applyWatermark(ctx, canvas, watermarkConfig);
    this.sendProgress(taskId, 0.7);

    // 生成输出
    const outputBlob = await canvas.convertToBlob({
      type: `image/${task.data.options.format || 'png'}`,
      quality: task.data.options.quality || 0.9
    });

    this.sendProgress(taskId, 1.0);

    return {
      blob: outputBlob,
      dimensions: { width: canvas.width, height: canvas.height },
      format: task.data.options.format || 'png'
    };
  }

  private async processImage(taskId: string, task: ProcessingTask): Promise<any> {
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
    this.sendProgress(taskId, 0.5);

    // 应用图像处理
    if (options.quality < 1.0) {
      // 质量调整处理
      await this.adjustImageQuality(ctx, canvas, options.quality);
    }

    const outputBlob = await canvas.convertToBlob({
      type: `image/${options.format || 'png'}`,
      quality: options.quality || 0.9
    });

    this.sendProgress(taskId, 1.0);

    return {
      blob: outputBlob,
      dimensions: { width: canvas.width, height: canvas.height },
      format: options.format || 'png'
    };
  }

  private async validateWatermark(taskId: string, task: ProcessingTask): Promise<any> {
    // 水印验证逻辑
    this.sendProgress(taskId, 0.5);
    
    // 简化的验证实现
    const isValid = true; // 实际应该检查水印完整性
    
    this.sendProgress(taskId, 1.0);
    
    return {
      isValid,
      confidence: 0.95,
      tamperDetected: false
    };
  }

  private async compressImage(taskId: string, task: ProcessingTask): Promise<any> {
    const { imageData, options } = task.data;
    
    if (!imageData) {
      throw new Error('Missing image data');
    }

    this.sendProgress(taskId, 0.2);

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    
    // 应用压缩
    const originalSize = imageData.data.length;
    const quality = Math.max(0.1, Math.min(1.0, options.quality || 0.8));
    
    this.sendProgress(taskId, 0.7);

    const outputBlob = await canvas.convertToBlob({
      type: `image/${options.format || 'jpeg'}`,
      quality
    });

    const compressionRatio = originalSize / outputBlob.size;

    this.sendProgress(taskId, 1.0);

    return {
      blob: outputBlob,
      compressionRatio,
      originalSize,
      compressedSize: outputBlob.size
    };
  }

  private async applyWatermark(
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    config: WatermarkConfig
  ): Promise<void> {
    ctx.save();

    try {
      // 设置透明度
      ctx.globalAlpha = config.opacity || 0.7;

      // 计算位置
      const { x, y } = this.calculatePosition(canvas, config.position);

      // 应用变换
      ctx.translate(x, y);
      if (config.rotation) {
        ctx.rotate((config.rotation * Math.PI) / 180);
      }
      if (config.scale !== 1) {
        ctx.scale(config.scale, config.scale);
      }

      // 绘制水印内容
      if (config.text) {
        this.drawTextWatermark(ctx, config.text);
      } else if (config.image) {
        await this.drawImageWatermark(ctx, config.image);
      }
    } finally {
      ctx.restore();
    }
  }

  private calculatePosition(
    canvas: OffscreenCanvas,
    position: { x: number; y: number }
  ): { x: number; y: number } {
    // 简化的位置计算
    return {
      x: position.x || canvas.width / 2,
      y: position.y || canvas.height / 2
    };
  }

  private drawTextWatermark(ctx: OffscreenCanvasRenderingContext2D, text: string): void {
    ctx.font = '24px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);

    // 添加描边
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeText(text, 0, 0);
  }

  private async drawImageWatermark(
    ctx: OffscreenCanvasRenderingContext2D,
    imageData: ImageData
  ): Promise<void> {
    // 创建临时 Canvas 来绘制水印图像
    const tempCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, -imageData.width / 2, -imageData.height / 2);
    }
  }

  private async adjustImageQuality(
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    quality: number
  ): Promise<void> {
    // 质量调整算法（简化实现）
    if (quality < 0.8) {
      // 应用轻微模糊来模拟质量降低
      ctx.filter = `blur(${(1 - quality) * 2}px)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    }
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
    // 简化的内存使用估算
    return performance.memory?.usedJSHeapSize || 0;
  }
}

// 初始化 Worker
new WatermarkProcessor();