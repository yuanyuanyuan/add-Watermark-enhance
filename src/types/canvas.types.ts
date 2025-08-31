/**
 * Canvas 渲染引擎相关类型定义
 * 基于架构文档的 Canvas API 设计
 */

export interface CanvasRenderingEngine {
  readonly context: CanvasRenderingContext2D | null;
  readonly canvas: HTMLCanvasElement;
  readonly pool: CanvasPool;
  readonly metrics: RenderingMetrics;
  
  initialize(canvas: HTMLCanvasElement): Promise<void>;
  render(operation: RenderOperation): Promise<RenderResult>;
  dispose(): void;
}

export interface CanvasPool {
  readonly activeCanvases: Set<HTMLCanvasElement>;
  readonly availableCanvases: HTMLCanvasElement[];
  readonly maxPoolSize: number;
  
  acquire(width: number, height: number): HTMLCanvasElement;
  release(canvas: HTMLCanvasElement): void;
  clear(): void;
}

export interface RenderOperation {
  type: 'watermark' | 'process' | 'composite';
  source: ImageData | HTMLCanvasElement | HTMLImageElement;
  watermark?: WatermarkConfig;
  options: RenderOptions;
}

export interface RenderOptions {
  quality: number; // 0.1 - 1.0
  format: 'png' | 'jpeg' | 'webp';
  compression?: number;
  preserveTransparency?: boolean;
}

export interface WatermarkConfig {
  text?: string;
  image?: HTMLImageElement;
  position: WatermarkPosition;
  opacity: number; // 0.0 - 1.0
  scale: number; // 0.1 - 2.0
  rotation?: number; // degrees
  blendMode?: GlobalCompositeOperation;
}

export interface WatermarkPosition {
  x: number | 'left' | 'center' | 'right';
  y: number | 'top' | 'middle' | 'bottom';
  offsetX?: number;
  offsetY?: number;
}

export interface RenderResult {
  success: boolean;
  canvas?: HTMLCanvasElement;
  dataUrl?: string;
  blob?: Blob;
  metrics: RenderingMetrics;
  error?: Error;
}

export interface RenderingMetrics {
  renderTime: number; // milliseconds
  memoryUsage: number; // bytes
  canvasSize: { width: number; height: number };
  operationCount: number;
  poolUtilization: number; // 0.0 - 1.0
}

export interface CanvasMemoryManager {
  readonly maxMemoryUsage: number;
  readonly currentMemoryUsage: number;
  
  trackCanvas(canvas: HTMLCanvasElement): void;
  releaseCanvas(canvas: HTMLCanvasElement): void;
  getMemoryUsage(): number;
  cleanup(): void;
}

export type CanvasError = 
  | 'CONTEXT_CREATION_FAILED'
  | 'MEMORY_LIMIT_EXCEEDED' 
  | 'INVALID_OPERATION'
  | 'POOL_EXHAUSTED'
  | 'RENDER_TIMEOUT';

export interface CanvasErrorInfo {
  code: CanvasError;
  message: string;
  context?: Record<string, unknown>;
}