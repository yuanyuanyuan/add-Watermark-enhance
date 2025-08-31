/**
 * WebWorker 并行处理相关类型定义
 * 基于架构文档的 WebWorker 设计
 */

export interface ProcessingTask {
  id: string;
  type: 'watermark' | 'process' | 'validate' | 'compress' | 'generate-certificate' | 'validate-certificate' | 'hash-generate' | 'resize' | 'format-convert' | 'optimize' | 'filter';
  data: TaskData;
  priority: TaskPriority;
  timeout?: number;
  onProgress?: (progress: number) => void;
}

export interface TaskData {
  imageData?: ImageData;
  canvas?: HTMLCanvasElement;
  watermarkConfig?: WatermarkConfig;
  options: ProcessingOptions;
  // 新增属性以支持不同类型的任务
  metadata?: any;
  certificate?: any;
  data?: Uint8Array;
  algorithm?: string;
  targetSize?: { width: number; height: number };
  targetFormat?: string;
  filterType?: string;
  intensity?: number;
  memory?: number;
}

export interface ProcessingOptions {
  quality: number;
  format: 'png' | 'jpeg' | 'webp';
  maxFileSize?: number;
  preserveMetadata?: boolean;
  // 扩展属性以支持更多操作
  targetSize?: { width: number; height: number };
  targetFormat?: string;
  filterType?: string;
  intensity?: number;
}

export interface WatermarkConfig {
  text?: string;
  image?: ImageData;
  position: { x: number; y: number };
  opacity: number;
  scale: number;
  rotation?: number;
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: TaskResultData;
  error?: WorkerError;
  metrics: ProcessingMetrics;
}

export interface TaskResultData {
  imageData?: ImageData;
  blob?: Blob;
  dataUrl?: string;
  certificate?: CertificateData;
}

export interface ProcessingMetrics {
  processingTime: number;
  memoryUsage: number;
  operationCount: number;
  compressionRatio?: number;
}

export interface WorkerPool {
  readonly workers: Map<string, Worker>;
  readonly activeWorkers: Set<string>;
  readonly taskQueue: ProcessingTask[];
  readonly maxWorkers: number;
  
  execute(task: ProcessingTask): Promise<TaskResult>;
  terminate(): void;
}

export interface CertificateData {
  hash: string;
  timestamp: number;
  signature: string;
  metadata: Record<string, unknown>;
}

export type WorkerError = 
  | 'WORKER_CREATION_FAILED'
  | 'TASK_TIMEOUT'
  | 'PROCESSING_ERROR'
  | 'MEMORY_OVERFLOW'
  | 'INVALID_DATA';

export interface WorkerMessage<T = unknown> {
  type: 'task' | 'progress' | 'result' | 'error';
  taskId: string;
  data: T;
  timestamp: number;
}

export interface WorkerTask extends ProcessingTask {
  workerId: string;
  startTime: number;
}