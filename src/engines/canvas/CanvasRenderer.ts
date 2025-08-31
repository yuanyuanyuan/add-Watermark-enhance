/**
 * Canvas 渲染引擎核心实现
 * 高性能图像处理和水印渲染
 * 基于架构文档的渲染引擎设计
 */

import type {
  CanvasRenderingEngine,
  RenderOperation,
  RenderResult,
  RenderingMetrics,
  CanvasError,
  CanvasErrorInfo
} from '@/types/canvas.types';
import { CanvasPool } from './CanvasPool';
import { MemoryManager } from './MemoryManager';

export class CanvasRenderer implements CanvasRenderingEngine {
  private _context: CanvasRenderingContext2D | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private readonly _pool: CanvasPool;
  private readonly _memoryManager: MemoryManager;
  private readonly _metrics: RenderingMetrics;
  private _initialized = false;

  constructor() {
    this._pool = new CanvasPool(10);
    this._memoryManager = new MemoryManager();
    this._metrics = this._createInitialMetrics();
  }

  get context(): CanvasRenderingContext2D | null {
    return this._context;
  }

  get canvas(): HTMLCanvasElement {
    if (!this._canvas) {
      throw this._createError('INVALID_OPERATION', 'Canvas not initialized');
    }
    return this._canvas;
  }

  get pool(): CanvasPool {
    return this._pool;
  }

  get metrics(): RenderingMetrics {
    return { ...this._metrics };
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * 初始化渲染引擎
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this._initialized) {
      console.warn('Canvas renderer already initialized');
      return;
    }

    try {
      this._canvas = canvas;
      this._context = canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: false,
        desynchronized: true
      });

      if (!this._context) {
        throw this._createError('CONTEXT_CREATION_FAILED', 'Failed to get 2D rendering context');
      }

      // 配置高质量渲染
      this._setupHighQualityRendering(this._context);
      
      // 跟踪主 Canvas
      this._memoryManager.trackCanvas(canvas);
      
      this._initialized = true;
      
      console.log('Canvas renderer initialized successfully');
    } catch (error) {
      throw this._createError('CONTEXT_CREATION_FAILED', 'Canvas initialization failed', error);
    }
  }

  /**
   * 执行渲染操作
   */
  async render(operation: RenderOperation): Promise<RenderResult> {
    if (!this._initialized) {
      throw this._createError('INVALID_OPERATION', 'Renderer not initialized');
    }

    const startTime = performance.now();
    const startMemory = this._memoryManager.currentMemoryUsage;

    try {
      let result: RenderResult;

      switch (operation.type) {
        case 'watermark':
          result = await this._renderWatermark(operation);
          break;
        case 'process':
          result = await this._processImage(operation);
          break;
        case 'composite':
          result = await this._compositeImages(operation);
          break;
        default:
          throw this._createError('INVALID_OPERATION', `Unknown operation type: ${operation.type}`);
      }

      // 更新性能指标
      this._updateMetrics(startTime, startMemory);
      result.metrics = this.metrics;

      return result;
    } catch (error) {
      return this._createErrorResult(error, startTime, startMemory);
    }
  }

  /**
   * 释放资源
   */
  dispose(): void {
    if (!this._initialized) {
      return;
    }

    // 清理池中的 Canvas
    this._pool.clear();
    
    // 清理内存管理器
    this._memoryManager.cleanup();
    
    // 清理主 Canvas
    if (this._canvas) {
      this._memoryManager.releaseCanvas(this._canvas);
    }

    this._context = null;
    this._canvas = null;
    this._initialized = false;

    console.log('Canvas renderer disposed');
  }

  private async _renderWatermark(operation: RenderOperation): Promise<RenderResult> {
    if (!operation.watermark || !this._context) {
      throw this._createError('INVALID_OPERATION', 'Watermark configuration missing');
    }

    const { source, watermark, options } = operation;
    
    // 创建工作 Canvas
    const workCanvas = this._pool.acquire(
      this._getSourceWidth(source),
      this._getSourceHeight(source)
    );
    const workCtx = workCanvas.getContext('2d')!;

    try {
      // 绘制原图
      await this._drawSource(workCtx, source);
      
      // 应用水印
      await this._applyWatermark(workCtx, watermark);
      
      // 生成输出
      const output = await this._generateOutput(workCanvas, options);
      
      return {
        success: true,
        canvas: workCanvas,
        ...output,
        metrics: this.metrics
      };
    } finally {
      // 确保资源清理
      if (workCanvas !== this._canvas) {
        this._pool.release(workCanvas);
      }
    }
  }

  private async _processImage(operation: RenderOperation): Promise<RenderResult> {
    if (!this._context) {
      throw this._createError('INVALID_OPERATION', 'Context not available');
    }

    const { source, options } = operation;
    
    const workCanvas = this._pool.acquire(
      this._getSourceWidth(source),
      this._getSourceHeight(source)
    );
    const workCtx = workCanvas.getContext('2d')!;

    try {
      // 绘制并处理图像
      await this._drawSource(workCtx, source);
      await this._applyImageProcessing(workCtx, options);
      
      const output = await this._generateOutput(workCanvas, options);
      
      return {
        success: true,
        canvas: workCanvas,
        ...output,
        metrics: this.metrics
      };
    } finally {
      if (workCanvas !== this._canvas) {
        this._pool.release(workCanvas);
      }
    }
  }

  private async _compositeImages(_operation: RenderOperation): Promise<RenderResult> {
    // 复合操作实现
    throw this._createError('INVALID_OPERATION', 'Composite operation not yet implemented');
  }

  private async _drawSource(
    ctx: CanvasRenderingContext2D,
    source: ImageData | HTMLCanvasElement | HTMLImageElement
  ): Promise<void> {
    if (source instanceof ImageData) {
      ctx.putImageData(source, 0, 0);
    } else if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
      ctx.drawImage(source, 0, 0);
    } else {
      throw this._createError('INVALID_OPERATION', 'Unsupported source type');
    }
  }

  private async _applyWatermark(
    ctx: CanvasRenderingContext2D,
    watermark: any // WatermarkConfig from types
  ): Promise<void> {
    ctx.save();
    
    try {
      // 设置透明度
      ctx.globalAlpha = watermark.opacity;
      
      // 设置混合模式
      if (watermark.blendMode) {
        ctx.globalCompositeOperation = watermark.blendMode;
      }
      
      // 计算位置
      const { x, y } = this._calculateWatermarkPosition(ctx.canvas, watermark.position);
      
      // 应用变换
      ctx.translate(x, y);
      if (watermark.rotation) {
        ctx.rotate((watermark.rotation * Math.PI) / 180);
      }
      if (watermark.scale !== 1) {
        ctx.scale(watermark.scale, watermark.scale);
      }
      
      // 绘制水印内容
      if (watermark.text) {
        this._drawTextWatermark(ctx, watermark);
      } else if (watermark.image) {
        this._drawImageWatermark(ctx, watermark);
      }
    } finally {
      ctx.restore();
    }
  }

  private _drawTextWatermark(ctx: CanvasRenderingContext2D, watermark: any): void {
    // 文本水印实现
    ctx.font = '24px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(watermark.text, 0, 0);
  }

  private _drawImageWatermark(ctx: CanvasRenderingContext2D, watermark: any): void {
    // 图像水印实现
    if (watermark.image instanceof HTMLImageElement) {
      ctx.drawImage(watermark.image, 0, 0);
    }
  }

  private async _applyImageProcessing(
    _ctx: CanvasRenderingContext2D,
    _options: any
  ): Promise<void> {
    // 图像处理实现（如调整亮度、对比度等）
    // 这里可以添加各种滤镜效果
  }

  private async _generateOutput(
    canvas: HTMLCanvasElement,
    options: any
  ): Promise<{ dataUrl?: string; blob?: Blob }> {
    const output: { dataUrl?: string; blob?: Blob } = {};
    
    // 生成 DataURL
    if (options.format) {
      output.dataUrl = canvas.toDataURL(`image/${options.format}`, options.quality);
    }
    
    // 生成 Blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          output.blob = blob;
        }
        resolve(output);
      }, `image/${options.format}`, options.quality);
    });
  }

  private _calculateWatermarkPosition(
    canvas: HTMLCanvasElement,
    position: any
  ): { x: number; y: number } {
    // 计算水印位置
    let x = 0, y = 0;
    
    if (typeof position.x === 'string') {
      switch (position.x) {
        case 'left': x = 0; break;
        case 'center': x = canvas.width / 2; break;
        case 'right': x = canvas.width; break;
      }
    } else {
      x = position.x;
    }
    
    if (typeof position.y === 'string') {
      switch (position.y) {
        case 'top': y = 0; break;
        case 'middle': y = canvas.height / 2; break;
        case 'bottom': y = canvas.height; break;
      }
    } else {
      y = position.y;
    }
    
    return { x: x + (position.offsetX || 0), y: y + (position.offsetY || 0) };
  }

  private _getSourceWidth(source: ImageData | HTMLCanvasElement | HTMLImageElement): number {
    if (source instanceof ImageData) return source.width;
    if ('width' in source) return source.width;
    return 0;
  }

  private _getSourceHeight(source: ImageData | HTMLCanvasElement | HTMLImageElement): number {
    if (source instanceof ImageData) return source.height;
    if ('height' in source) return source.height;
    return 0;
  }

  private _setupHighQualityRendering(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'start';
  }

  private _createInitialMetrics(): RenderingMetrics {
    return {
      renderTime: 0,
      memoryUsage: 0,
      canvasSize: { width: 0, height: 0 },
      operationCount: 0,
      poolUtilization: 0
    };
  }

  private _updateMetrics(startTime: number, startMemory: number): void {
    this._metrics.renderTime = performance.now() - startTime;
    this._metrics.memoryUsage = this._memoryManager.currentMemoryUsage - startMemory;
    this._metrics.operationCount++;
    this._metrics.poolUtilization = this._pool.utilization;
    
    if (this._canvas) {
      this._metrics.canvasSize = {
        width: this._canvas.width,
        height: this._canvas.height
      };
    }
  }

  private _createError(code: CanvasError, message: string, originalError?: any): CanvasErrorInfo {
    return {
      code,
      message,
      context: originalError ? { originalError: originalError.message } : undefined
    };
  }

  private _createErrorResult(error: any, startTime: number, startMemory: number): RenderResult {
    this._updateMetrics(startTime, startMemory);
    
    return {
      success: false,
      error: error instanceof Error ? this._createError('RENDER_TIMEOUT', error.message) : error,
      metrics: this.metrics
    };
  }
}