/**
 * 应用全局类型定义
 * 基于架构文档的应用状态管理设计
 */

import type { CanvasRenderingEngine, CanvasPool } from './canvas.types';
import type { WorkerPool, ProcessingTask } from './worker.types';
import type { WatermarkProcessor, WatermarkSettings, WatermarkResult } from './watermark.types';

export interface WatermarkAppState {
  // Canvas 渲染引擎状态
  canvas: {
    engine: CanvasRenderingEngine | null;
    context: CanvasRenderingContext2D | null;
    pool: CanvasPool;
    activeCanvases: Set<HTMLCanvasElement>;
    chineseRenderer: {
      initialized: boolean;
      optimalFont: string | null;
      renderQuality: string;
      supportedFeatures: string[];
    };
  };
  
  // WebWorker 并行处理状态
  workers: {
    pool: WorkerPool;
    activeWorkers: Map<string, Worker>;
    taskQueue: ProcessingTask[];
  };
  
  // CDN库管理状态
  cdn: {
    initialized: boolean;
    status?: 'error' | 'loading' | 'ready';
    loadedLibraries?: Set<string> | string[];
    loadingProgress?: Map<string, number>;
    stats?: Record<string, any>;
    healthMetrics?: Record<string, any>;
    supportedFeatures?: string[];
    lastError?: Error | null;
  };
  
  // PDF引擎状态
  pdfEngine: {
    initialized: boolean;
    status?: 'idle' | 'loading' | 'ready' | 'error';
    supportedFeatures?: string[];
    lastError?: any;
  };
  
  // 文件处理状态
  files: {
    selected: File[];
    processing: Map<string, ProcessingStatus>;
    results: Map<string, WatermarkResult>;
    statistics: {
      totalProcessed: number;
      successCount: number;
      errorCount: number;
      averageProcessingTime: number;
      chineseContentDetected: number;
    };
  };
  
  // 水印设置状态
  watermark: {
    processor: WatermarkProcessor | null;
    settings: WatermarkSettings;
    presets: WatermarkPreset[];
  };
  
  // UI 状态
  ui: {
    loading: boolean;
    error: AppError | null;
    progress: ProgressInfo | null;
    activeView: ViewType;
    modals: ModalState;
  };
  
  // 性能监控状态
  performance: {
    metrics: PerformanceMetrics;
    warnings: PerformanceWarning[];
    memoryUsage: number;
  };
  
}

export interface ProcessingStatus {
  fileId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0.0 - 1.0
  startTime: number;
  endTime?: number;
  error?: AppError;
}

export interface WatermarkPreset {
  id: string;
  name: string;
  description: string;
  settings: WatermarkSettings;
  thumbnail?: string;
  isDefault: boolean;
}

export interface ProgressInfo {
  current: number;
  total: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export type ViewType = 'upload' | 'editor' | 'preview' | 'batch' | 'settings' | 'help';

export interface ModalState {
  settings: boolean;
  help: boolean;
  error: boolean;
  certificate: boolean;
  presets: boolean;
}

export interface PerformanceMetrics {
  averageProcessingTime: number;
  totalFilesProcessed: number;
  memoryPeakUsage: number;
  canvasPoolEfficiency: number;
  workerPoolUtilization: number;
  renderFrameRate: number;
}

export interface PerformanceWarning {
  type: 'memory' | 'performance' | 'compatibility';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  suggestion?: string;
}

export type AppError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: number;
  userMessage: string;
  recoverable: boolean;
};

// 健康检查相关类型
export interface HealthCheckResult {
  overall: 'healthy' | 'warning' | 'error';
  canvas: 'ready' | 'error' | 'not_initialized';
  cdn: 'ready' | 'loading' | 'error' | 'not_initialized';
  pdfEngine: 'ready' | 'loading' | 'error' | 'not_initialized';
  workers: 'ready' | 'error' | 'not_initialized';
  timestamp: number;
  details?: Record<string, unknown>;
  components?: {
    cdn: 'healthy' | 'warning' | 'error';
    canvasRenderer: 'healthy' | 'warning' | 'error';
    pdfEngine: 'healthy' | 'warning' | 'error';
    stateManagement: 'healthy' | 'warning' | 'error';
  };
  recommendations?: string[];
}

export interface CDNStatus {
  initialized: boolean;
  loadedLibraries: string[];
  healthMetrics?: {
    latency: number;
    availability: number;
  };
  supportedFeatures?: string[];
  lastError?: Error | null;
}

export interface EngineStatus {
  canvas: {
    initialized: boolean;
    context: boolean;
    chineseRenderer: boolean;
  };
  pdf: {
    initialized: boolean;
    supportedFeatures: string[];
  };
  pdfEngine: {
    initialized: boolean;
    status: string;
    supportedFeatures: string[];
    lastError: any;
  };
  workers: {
    active: number;
    total: number;
    healthy: boolean;
  };
}

// Zustand Store Actions
export interface WatermarkAppActions {
  // Canvas 引擎操作
  initializeCanvas: () => Promise<void>;
  disposeCanvas: () => void;
  
  // 系统初始化操作
  initializeSystem: () => Promise<void>;
  
  // 文件操作
  selectFiles: (files: File[]) => void;
  processFiles: (settings: WatermarkSettings) => Promise<void>;
  clearFiles: () => void;
  
  // 水印设置操作
  updateWatermarkSettings: (settings: Partial<WatermarkSettings>) => void;
  savePreset: (preset: Omit<WatermarkPreset, 'id'>) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  
  // UI 操作
  setActiveView: (view: ViewType) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: AppError | null) => void;
  showModal: (modal: keyof ModalState) => void;
  hideModal: (modal: keyof ModalState) => void;
  
  // 性能监控操作
  updateMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  addWarning: (warning: PerformanceWarning) => void;
  clearWarnings: () => void;
  
  // 健康检查操作
  performHealthCheck: () => Promise<HealthCheckResult>;
  getCDNStatus: () => CDNStatus;
  getEngineStatus: () => EngineStatus;
  
  // 辅助方法
  blobToDataURL: (blob: Blob) => Promise<string>;
}

export type WatermarkStore = WatermarkAppState & WatermarkAppActions;

// 组件 Props 类型
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface FileUploaderProps extends BaseComponentProps {
  onFilesSelect: (files: File[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedFormats?: string[];
}

export interface WatermarkEditorProps extends BaseComponentProps {
  settings: WatermarkSettings;
  onChange: (settings: WatermarkSettings) => void;
  presets: WatermarkPreset[];
}

export interface CanvasViewportProps extends BaseComponentProps {
  canvas: HTMLCanvasElement | null;
  interactive?: boolean;
  onCanvasClick?: (x: number, y: number) => void;
}

// 常用联合类型
export type SupportedImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';
export type ProcessingPhase = 'upload' | 'watermark' | 'process' | 'validate' | 'export';
export type BrowserCompatibility = 'full' | 'partial' | 'unsupported';