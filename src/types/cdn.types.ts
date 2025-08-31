/**
 * CDN库管理类型定义
 * 支持多CDN备用、依赖管理、性能监控等功能
 */

export interface CDNLibrary {
  name: string;
  urls: string[];        // 多CDN备用地址
  globalName: string;    // 全局变量名  
  dependencies?: string[]; // 依赖关系
  timeout: number;       // 加载超时时间(ms)
  retryAttempts?: number; // 重试次数
  priority?: number;     // 优先级 (数字越小优先级越高)
}

export interface LibraryLoadResult {
  success: boolean;
  library: string;
  loadTime: number;
  cdnUrl?: string;
  error?: string;
  method: 'cache' | 'network' | 'fallback';
}

export interface LoadingProgress {
  library: string;
  status: 'pending' | 'loading' | 'loaded' | 'failed';
  progress: number;      // 0-100
  currentUrl?: string;
  attempt: number;       // 当前尝试次数
  startTime: number;
}

export interface CDNHealthMetrics {
  successRate: number;
  averageResponseTime: number;
  lastSuccessTime: number;
  failureCount: number;
  totalRequests: number;
}

export interface CDNMonitorStats {
  [cdnUrl: string]: CDNHealthMetrics;
}

export interface LibraryLoadOptions {
  timeout?: number;
  retryAttempts?: number;
  preferredCdns?: string[];
  fallbackToLocal?: boolean;
}

export interface CDNError extends Error {
  code: 'TIMEOUT' | 'NETWORK_ERROR' | 'DEPENDENCY_FAILED' | 'GLOBAL_NOT_FOUND' | 'ALL_CDNS_FAILED';
  library: string;
  url?: string;
  originalError?: Error;
}

// 全局类型扩展 - 确保CDN库在window对象上的类型安全
declare global {
  interface Window {
    JSZip: typeof import('jszip');
    mammoth: {
      extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{
        value: string;
        messages: Array<{ type: string; message: string }>;
      }>;
    };
    PDFLib: {
      PDFDocument: {
        create: () => Promise<any>;
        load: (data: ArrayBuffer) => Promise<any>;
      };
      PageSizes: Record<string, [number, number]>;
      rgb: (r: number, g: number, b: number) => any;
    };
    fontkit: any;
  }
}

export interface CDNConfig {
  retryAttempts: number;
  retryDelay: number;        // 重试延迟(ms)
  defaultTimeout: number;    // 默认超时时间(ms)
  fallbackEnabled: boolean;  // 是否启用本地降级
  enableMonitoring: boolean; // 是否启用性能监控
  maxConcurrentLoads: number; // 最大并发加载数
}