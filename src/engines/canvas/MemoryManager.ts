/**
 * Canvas 内存管理器
 * 实现内存使用监控和自动清理
 * 基于架构文档的内存管理设计
 */

import type { CanvasMemoryManager } from '@/types/canvas.types';

interface CanvasMemoryInfo {
  canvas: HTMLCanvasElement;
  size: number;
  lastAccess: number;
  accessCount: number;
}

export class MemoryManager implements CanvasMemoryManager {
  private readonly _maxMemoryUsage: number;
  private readonly _canvasMemoryMap = new Map<HTMLCanvasElement, CanvasMemoryInfo>();
  private readonly _cleanupThreshold: number;
  private _lastCleanup = 0;
  private readonly _cleanupInterval = 30000; // 30 seconds

  constructor(maxMemoryUsage = 512 * 1024 * 1024) { // 512MB default
    this._maxMemoryUsage = maxMemoryUsage;
    this._cleanupThreshold = maxMemoryUsage * 0.8; // 80% threshold

    // 启动定期清理
    this._startPeriodicCleanup();
  }

  get maxMemoryUsage(): number {
    return this._maxMemoryUsage;
  }

  get currentMemoryUsage(): number {
    return this.getMemoryUsage();
  }

  /**
   * 跟踪一个 Canvas 对象
   */
  trackCanvas(canvas: HTMLCanvasElement): void {
    const size = this._calculateCanvasSize(canvas);
    
    this._canvasMemoryMap.set(canvas, {
      canvas,
      size,
      lastAccess: Date.now(),
      accessCount: 1
    });

    // 检查内存使用情况
    if (this.currentMemoryUsage > this._cleanupThreshold) {
      this._performCleanup();
    }
  }

  /**
   * 释放一个 Canvas 对象
   */
  releaseCanvas(canvas: HTMLCanvasElement): void {
    this._canvasMemoryMap.delete(canvas);
  }

  /**
   * 更新 Canvas 访问记录
   */
  accessCanvas(canvas: HTMLCanvasElement): void {
    const info = this._canvasMemoryMap.get(canvas);
    if (info) {
      info.lastAccess = Date.now();
      info.accessCount++;
    }
  }

  /**
   * 获取当前内存使用量
   */
  getMemoryUsage(): number {
    let total = 0;
    for (const info of this._canvasMemoryMap.values()) {
      total += info.size;
    }
    return total;
  }

  /**
   * 获取内存使用详情
   */
  getMemoryDetails() {
    const canvases = Array.from(this._canvasMemoryMap.values());
    const totalMemory = this.getMemoryUsage();
    const utilization = totalMemory / this._maxMemoryUsage;

    return {
      totalMemory,
      maxMemory: this._maxMemoryUsage,
      utilization,
      canvasCount: canvases.length,
      averageCanvasSize: canvases.length > 0 ? totalMemory / canvases.length : 0,
      largestCanvas: Math.max(...canvases.map(c => c.size), 0),
      oldestAccess: Math.min(...canvases.map(c => c.lastAccess), Date.now()),
      memoryPressure: this._getMemoryPressure(utilization)
    };
  }

  /**
   * 执行内存清理
   */
  cleanup(): void {
    this._performCleanup();
  }

  /**
   * 强制垃圾回收（在支持的浏览器中）
   */
  forceGC(): void {
    if ('gc' in window && typeof window.gc === 'function') {
      window.gc();
    }
  }

  /**
   * 检查内存压力状态
   */
  checkMemoryPressure(): 'low' | 'medium' | 'high' | 'critical' {
    const utilization = this.currentMemoryUsage / this._maxMemoryUsage;
    return this._getMemoryPressure(utilization);
  }

  /**
   * 获取清理建议
   */
  getCleanupRecommendations(): string[] {
    const details = this.getMemoryDetails();
    const recommendations: string[] = [];

    if (details.utilization > 0.7) {
      recommendations.push('内存使用率较高，建议清理不活跃的 Canvas');
    }

    if (details.canvasCount > 20) {
      recommendations.push(`当前有 ${details.canvasCount} 个 Canvas 对象，考虑释放部分对象`);
    }

    if (details.largestCanvas > 50 * 1024 * 1024) { // 50MB
      recommendations.push('存在大尺寸 Canvas 对象，考虑降低分辨率');
    }

    const oldestAge = Date.now() - details.oldestAccess;
    if (oldestAge > 300000) { // 5 minutes
      recommendations.push('存在长时间未访问的 Canvas 对象');
    }

    return recommendations;
  }

  private _calculateCanvasSize(canvas: HTMLCanvasElement): number {
    // RGBA 每像素 4 字节
    return canvas.width * canvas.height * 4;
  }

  private _performCleanup(): void {
    const now = Date.now();
    const canvases = Array.from(this._canvasMemoryMap.values());
    
    // 按最后访问时间和访问频率排序
    canvases.sort((a, b) => {
      const scoreA = this._calculateCleanupScore(a, now);
      const scoreB = this._calculateCleanupScore(b, now);
      return scoreB - scoreA; // 分数高的优先清理
    });

    // 清理分数最高的 Canvas 直到内存使用降到安全水平
    let cleanedMemory = 0;
    const targetMemory = this._maxMemoryUsage * 0.6; // 降到 60%

    for (const info of canvases) {
      if (this.currentMemoryUsage - cleanedMemory <= targetMemory) {
        break;
      }

      this._cleanupCanvas(info.canvas);
      cleanedMemory += info.size;
    }

    this._lastCleanup = now;
    
    console.log(`Memory cleanup completed: freed ${(cleanedMemory / 1024 / 1024).toFixed(2)}MB`);
  }

  private _calculateCleanupScore(info: CanvasMemoryInfo, now: number): number {
    const timeSinceAccess = now - info.lastAccess;
    const sizeScore = info.size / (1024 * 1024); // MB
    const timeScore = timeSinceAccess / (1000 * 60); // minutes
    const accessScore = 1 / Math.max(info.accessCount, 1);

    // 综合评分：大小 + 时间 + 访问频率
    return sizeScore * 0.4 + timeScore * 0.4 + accessScore * 0.2;
  }

  private _cleanupCanvas(canvas: HTMLCanvasElement): void {
    // 清空 Canvas 内容
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // 从跟踪中移除
    this._canvasMemoryMap.delete(canvas);
  }

  private _getMemoryPressure(utilization: number): 'low' | 'medium' | 'high' | 'critical' {
    if (utilization >= 0.95) return 'critical';
    if (utilization >= 0.8) return 'high';
    if (utilization >= 0.6) return 'medium';
    return 'low';
  }

  private _startPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      if (now - this._lastCleanup >= this._cleanupInterval) {
        this._performCleanup();
      }
    }, this._cleanupInterval);
  }
}