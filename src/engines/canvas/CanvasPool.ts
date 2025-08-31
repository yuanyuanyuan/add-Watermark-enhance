/**
 * Canvas 对象池管理器
 * 实现内存高效的 Canvas 资源复用
 * 基于架构文档的内存池管理设计
 */

import type { CanvasPool as ICanvasPool } from '@/types/canvas.types';

export class CanvasPool implements ICanvasPool {
  private readonly _activeCanvases = new Set<HTMLCanvasElement>();
  private readonly _availableCanvases: HTMLCanvasElement[] = [];
  private readonly _maxPoolSize: number;
  private _currentPoolSize = 0;

  constructor(maxPoolSize = 10) {
    this._maxPoolSize = maxPoolSize;
  }

  get activeCanvases(): Set<HTMLCanvasElement> {
    return new Set(this._activeCanvases);
  }

  get availableCanvases(): HTMLCanvasElement[] {
    return [...this._availableCanvases];
  }

  get maxPoolSize(): number {
    return this._maxPoolSize;
  }

  get currentPoolSize(): number {
    return this._currentPoolSize;
  }

  get utilization(): number {
    return this._activeCanvases.size / this._maxPoolSize;
  }

  /**
   * 获取一个 Canvas 对象
   */
  acquire(width: number, height: number): HTMLCanvasElement {
    let canvas = this._findSuitableCanvas(width, height);
    
    if (!canvas) {
      canvas = this._createCanvas(width, height);
    } else {
      this._removeFromAvailable(canvas);
      this._resizeCanvas(canvas, width, height);
    }

    this._activeCanvases.add(canvas);
    return canvas;
  }

  /**
   * 释放一个 Canvas 对象回池中
   */
  release(canvas: HTMLCanvasElement): void {
    if (!this._activeCanvases.has(canvas)) {
      console.warn('Attempting to release canvas not managed by this pool');
      return;
    }

    this._activeCanvases.delete(canvas);
    this._clearCanvas(canvas);

    if (this._availableCanvases.length < this._maxPoolSize) {
      this._availableCanvases.push(canvas);
    } else {
      this._disposeCanvas(canvas);
      this._currentPoolSize--;
    }
  }

  /**
   * 清空池中所有 Canvas
   */
  clear(): void {
    // 清理活跃的 Canvas
    for (const canvas of this._activeCanvases) {
      this._disposeCanvas(canvas);
    }
    this._activeCanvases.clear();

    // 清理可用的 Canvas
    for (const canvas of this._availableCanvases) {
      this._disposeCanvas(canvas);
    }
    this._availableCanvases.length = 0;
    this._currentPoolSize = 0;
  }

  /**
   * 获取池的统计信息
   */
  getStats() {
    return {
      active: this._activeCanvases.size,
      available: this._availableCanvases.length,
      total: this._currentPoolSize,
      utilization: this.utilization,
      memoryEstimate: this._estimateMemoryUsage()
    };
  }

  private _findSuitableCanvas(width: number, height: number): HTMLCanvasElement | null {
    // 寻找尺寸相近的 Canvas 以减少内存重分配
    const targetArea = width * height;
    let bestCanvas: HTMLCanvasElement | null = null;
    let bestScore = Infinity;

    for (const canvas of this._availableCanvases) {
      const canvasArea = canvas.width * canvas.height;
      const areaRatio = Math.max(targetArea / canvasArea, canvasArea / targetArea);
      
      // 优选尺寸相近的 Canvas
      if (areaRatio <= 2 && areaRatio < bestScore) {
        bestScore = areaRatio;
        bestCanvas = canvas;
      }
    }

    return bestCanvas;
  }

  private _createCanvas(width: number, height: number): HTMLCanvasElement {
    if (this._currentPoolSize >= this._maxPoolSize) {
      throw new Error(`Canvas pool exhausted: ${this._maxPoolSize} canvases already created`);
    }

    const canvas = document.createElement('canvas');
    this._resizeCanvas(canvas, width, height);
    this._currentPoolSize++;
    
    return canvas;
  }

  private _resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
    canvas.width = width;
    canvas.height = height;
    
    // 设置高质量渲染选项
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }

  private _removeFromAvailable(canvas: HTMLCanvasElement): void {
    const index = this._availableCanvases.indexOf(canvas);
    if (index > -1) {
      this._availableCanvases.splice(index, 1);
    }
  }

  private _clearCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置变换矩阵
    }
  }

  private _disposeCanvas(canvas: HTMLCanvasElement): void {
    // 清理 Canvas 内容
    this._clearCanvas(canvas);
    
    // 设置为最小尺寸以释放内存
    canvas.width = 1;
    canvas.height = 1;
  }

  private _estimateMemoryUsage(): number {
    let totalMemory = 0;
    
    for (const canvas of this._activeCanvases) {
      totalMemory += canvas.width * canvas.height * 4; // RGBA 4 bytes per pixel
    }
    
    for (const canvas of this._availableCanvases) {
      totalMemory += canvas.width * canvas.height * 4;
    }
    
    return totalMemory;
  }
}