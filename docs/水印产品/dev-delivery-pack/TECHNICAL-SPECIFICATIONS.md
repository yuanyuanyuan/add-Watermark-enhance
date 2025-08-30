# [水印增强产品] - 技术规范文档

> **版本**: v1.0.0  
> **创建时间**: 2025-08-30  
> **适用范围**: 水印增强产品项目开发团队  
> **技术栈**: React 18 + TypeScript 5.0 + Canvas API + Web Workers

## 📋 文档概览

本技术规范文档为水印增强产品项目定义了编码标准、开发流程、质量保证和最佳实践。所有团队成员必须严格遵循本规范以确保代码质量、一致性和可维护性。重点关注Canvas渲染引擎、WebWorker并行处理和浏览器端安全机制的技术实现规范。

---

## 🔧 技术环境规范

### 核心技术栈要求

```typescript
// 必需版本要求
{
  "react": "^18.2.0",           // React 18 - 并发特性和性能优化
  "typescript": "^5.0.0",       // TypeScript 严格模式
  "vite": "^4.0.0",            // Vite 构建工具
  "vitest": "^1.0.0",          // 测试框架
  "@types/react": "^18.2.0",    // React 类型定义
  "zustand": "^4.4.0",         // 轻量级状态管理
  "tailwindcss": "^3.0.0"      // CSS框架
}
```

### 开发环境配置

#### Node.js 版本要求
- **最低版本**: Node.js 18.x
- **推荐版本**: Node.js 20.x 或更高
- **包管理器**: npm 9.x 或更高

#### IDE 配置要求

```json
// .vscode/settings.json (推荐设置)
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.exclude": {
    "**/.backup": true,
    "**/node_modules": true,
    "**/dist": true
  },
  // Canvas开发专用配置
  "typescript.preferences.useAliasesForRenames": false,
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

### Canvas开发环境专用配置

```typescript
// Canvas开发工具配置
interface CanvasDevelopmentConfig {
  // Canvas调试配置
  debugging: {
    enableCanvasProfiler: boolean;     // Canvas性能分析器
    showMemoryUsage: boolean;          // 显示内存使用情况
    trackCanvasOperations: boolean;    // 跟踪Canvas操作
    enableWebGLDebug: boolean;         // WebGL调试模式
  };
  
  // 性能监控配置
  performance: {
    frameRateMonitoring: boolean;      // 帧率监控
    memoryLeakDetection: boolean;      // 内存泄漏检测
    canvasPoolMetrics: boolean;        // Canvas池指标
  };
  
  // WebWorker开发配置
  workers: {
    enableWorkerProfiling: boolean;    // Worker性能分析
    debugWorkerMessages: boolean;      // 调试Worker消息
    workerPoolVisualization: boolean;  // Worker池可视化
  };
}
```

---

## 📝 编码规范

### TypeScript 编码标准

#### 类型定义规范

```typescript
// ✅ 正确：详细的Canvas相关接口定义
interface WatermarkAppState {
  // 文件处理状态
  file: {
    original: File | null;
    processed: Blob | null;
    metadata: ImageMetadata | null;
  };
  
  // Canvas渲染状态
  canvas: {
    engine: CanvasRenderingEngine | null;
    context: CanvasRenderingContext2D | null;
    pool: CanvasPool;
    activeCanvases: Set<HTMLCanvasElement>;
  };
  
  // WebWorker状态
  workers: {
    pool: WorkerPool;
    activeWorkers: Map<string, Worker>;
    taskQueue: ProcessingTask[];
    processingStatus: ProcessingStatus;
  };
  
  // 水印配置状态
  watermark: {
    type: WatermarkType;
    content: string | ImageData;
    position: WatermarkPosition;
    style: WatermarkStyle;
    certificate: DigitalCertificate | null;
  };
  
  // UI交互状态
  ui: {
    activeTab: TabType;
    sidebarOpen: boolean;
    theme: ThemeType;
    canvasViewport: CanvasViewport;
  };
}

// ✅ 正确：Canvas专用类型定义
export type CanvasOperation =
  | { type: 'INIT_CANVAS'; payload: CanvasInitConfig }
  | { type: 'RENDER_WATERMARK'; payload: { imageData: ImageData; watermark: Watermark } }
  | { type: 'CLEAR_CANVAS'; payload: { preserveBackground: boolean } }
  | { type: 'EXPORT_RESULT'; payload: ExportConfig };

// ✅ 正确：WebWorker消息类型
export type WorkerMessage<T extends string> = T extends 'progress' 
  ? { type: T; progress: number; stage: ProcessingStage }
  : T extends 'result'
  ? { type: T; imageData: ImageData; certificate: DigitalCertificate }
  : T extends 'error'
  ? { type: T; error: string; stack?: string }
  : { type: T; payload: unknown };

// ❌ 错误：过于宽泛的类型
interface BadCanvasState {
  data: any;        // 避免使用 any
  config: object;   // 避免使用 object
  status: string;   // 应该使用联合类型
}
```

#### Canvas专用类型系统

```typescript
// Canvas渲染引擎类型系统
namespace CanvasTypes {
  // Canvas配置类型
  export interface CanvasConfig {
    width: number;
    height: number;
    devicePixelRatio: number;
    imageSmoothingEnabled: boolean;
    imageSmoothingQuality: ImageSmoothingQuality;
  }
  
  // 渲染管线类型
  export interface RenderingPipeline {
    stages: RenderingStage[];
    currentStage: number;
    totalStages: number;
    optimizations: RenderingOptimization[];
  }
  
  // Canvas池配置
  export interface CanvasPoolConfig {
    maxPoolSize: number;
    cleanupInterval: number;
    memoryThreshold: number;
    enableMetrics: boolean;
  }
  
  // 性能指标类型
  export interface CanvasPerformanceMetrics {
    renderTime: number;
    memoryUsage: number;
    fps: number;
    canvasCount: number;
    poolHitRate: number;
  }
}
```

### React 组件开发规范

#### Canvas组件标准结构

```typescript
// ✅ 正确：Canvas组件实现模式
interface WatermarkCanvasProps {
  imageFile: File;
  watermarkConfig: WatermarkConfig;
  onRenderComplete?: (result: RenderResult) => void;
  onProgress?: (progress: number) => void;
  className?: string;
  canvasConfig?: Partial<CanvasConfig>;
}

const WatermarkCanvas: React.FC<WatermarkCanvasProps> = React.memo(({
  imageFile,
  watermarkConfig,
  onRenderComplete,
  onProgress,
  className,
  canvasConfig
}) => {
  // 1. Canvas引用管理
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasEngineRef = useRef<CanvasRenderingEngine | null>(null);
  
  // 2. 状态管理
  const [renderState, setRenderState] = useState<RenderState>({
    status: 'idle',
    progress: 0,
    error: null
  });
  
  // 3. Canvas Hook使用
  const { 
    initializeCanvas,
    renderWatermark,
    cleanup,
    getMetrics 
  } = useCanvasEngine({
    canvas: canvasRef.current,
    config: canvasConfig,
    onProgress
  });
  
  // 4. WebWorker Hook使用
  const {
    processImageInWorker,
    workerStatus,
    terminateWorkers
  } = useWebWorker({
    workerCount: navigator.hardwareConcurrency || 4,
    onMessage: handleWorkerMessage
  });
  
  // 5. 性能优化：记忆化计算
  const processedConfig = useMemo(() => {
    return optimizeWatermarkConfig(watermarkConfig);
  }, [watermarkConfig]);
  
  const canvasStyle = useMemo(() => ({
    maxWidth: '100%',
    height: 'auto',
    imageRendering: 'pixelated' as const,
    ...canvasConfig?.style
  }), [canvasConfig?.style]);
  
  // 6. 副作用管理
  useEffect(() => {
    let mounted = true;
    
    const processImage = async () => {
      if (!imageFile || !processedConfig) return;
      
      try {
        setRenderState(prev => ({ ...prev, status: 'processing', progress: 0 }));
        
        // 初始化Canvas引擎
        const engine = await initializeCanvas({
          file: imageFile,
          config: processedConfig
        });
        
        canvasEngineRef.current = engine;
        
        // WebWorker处理
        const result = await processImageInWorker({
          imageData: await fileToImageData(imageFile),
          watermark: processedConfig,
          canvasEngine: engine
        });
        
        if (!mounted) return;
        
        setRenderState({
          status: 'completed',
          progress: 100,
          error: null
        });
        
        onRenderComplete?.(result);
        
      } catch (error) {
        if (!mounted) return;
        
        setRenderState({
          status: 'error',
          progress: 0,
          error: error as Error
        });
      }
    };
    
    processImage();
    
    return () => {
      mounted = false;
      cleanup();
      terminateWorkers();
    };
  }, [imageFile, processedConfig, initializeCanvas, processImageInWorker, cleanup, terminateWorkers, onRenderComplete]);
  
  // 7. 错误处理
  if (renderState.error) {
    return (
      <div className="canvas-error">
        <p>Canvas渲染错误: {renderState.error.message}</p>
        <button onClick={() => setRenderState({ status: 'idle', progress: 0, error: null })}>
          重试
        </button>
      </div>
    );
  }
  
  // 8. 加载状态
  if (renderState.status === 'processing') {
    return (
      <div className="canvas-loading">
        <canvas ref={canvasRef} className={className} style={canvasStyle} />
        <div className="progress-overlay">
          <progress value={renderState.progress} max={100}>
            {renderState.progress}%
          </progress>
          <p>Canvas渲染中... {renderState.progress.toFixed(1)}%</p>
        </div>
      </div>
    );
  }
  
  // 9. 正常渲染
  return (
    <canvas 
      ref={canvasRef}
      className={className}
      style={canvasStyle}
      onContextMenu={(e) => e.preventDefault()} // 禁用右键菜单
    />
  );
});

// 设置显示名称
WatermarkCanvas.displayName = 'WatermarkCanvas';

export default WatermarkCanvas;
```

#### Hook开发规范

```typescript
// ✅ 正确：Canvas专用Hook实现
interface UseCanvasEngineOptions {
  canvas: HTMLCanvasElement | null;
  config?: Partial<CanvasConfig>;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

interface UseCanvasEngineReturn {
  initializeCanvas: (options: InitCanvasOptions) => Promise<CanvasRenderingEngine>;
  renderWatermark: (watermark: Watermark) => Promise<ImageData>;
  cleanup: () => void;
  getMetrics: () => CanvasPerformanceMetrics;
  isReady: boolean;
}

export const useCanvasEngine = (
  options: UseCanvasEngineOptions
): UseCanvasEngineReturn => {
  // 1. 状态管理
  const [isReady, setIsReady] = useState(false);
  const [engine, setEngine] = useState<CanvasRenderingEngine | null>(null);
  
  // 2. 引用管理
  const canvasPoolRef = useRef<CanvasPool | null>(null);
  const metricsCollectorRef = useRef<PerformanceMetricsCollector | null>(null);
  const cleanupCallbacksRef = useRef<Array<() => void>>([]);
  
  // 3. Canvas初始化
  const initializeCanvas = useCallback(async (initOptions: InitCanvasOptions) => {
    if (!options.canvas) {
      throw new Error('Canvas element is required');
    }
    
    try {
      // 创建Canvas池
      canvasPoolRef.current = new CanvasPool({
        maxPoolSize: 10,
        enableMetrics: true,
        memoryThreshold: 512 * 1024 * 1024 // 512MB
      });
      
      // 创建性能监控器
      metricsCollectorRef.current = new PerformanceMetricsCollector();
      
      // 创建Canvas引擎
      const canvasEngine = new CanvasRenderingEngine({
        canvas: options.canvas,
        pool: canvasPoolRef.current,
        metrics: metricsCollectorRef.current,
        config: options.config,
        onProgress: options.onProgress
      });
      
      await canvasEngine.initialize(initOptions);
      
      setEngine(canvasEngine);
      setIsReady(true);
      
      // 注册清理回调
      cleanupCallbacksRef.current.push(() => {
        canvasEngine.dispose();
      });
      
      return canvasEngine;
      
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }, [options.canvas, options.config, options.onProgress, options.onError]);
  
  // 4. 水印渲染
  const renderWatermark = useCallback(async (watermark: Watermark) => {
    if (!engine || !isReady) {
      throw new Error('Canvas engine not ready');
    }
    
    try {
      const result = await engine.renderWatermark(watermark);
      return result;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }, [engine, isReady, options.onError]);
  
  // 5. 性能指标获取
  const getMetrics = useCallback(() => {
    if (!metricsCollectorRef.current) {
      return {
        renderTime: 0,
        memoryUsage: 0,
        fps: 0,
        canvasCount: 0,
        poolHitRate: 0
      };
    }
    
    return metricsCollectorRef.current.getMetrics();
  }, []);
  
  // 6. 资源清理
  const cleanup = useCallback(() => {
    // 执行所有清理回调
    cleanupCallbacksRef.current.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    
    // 清理Canvas池
    if (canvasPoolRef.current) {
      canvasPoolRef.current.dispose();
      canvasPoolRef.current = null;
    }
    
    // 清理性能监控器
    if (metricsCollectorRef.current) {
      metricsCollectorRef.current.dispose();
      metricsCollectorRef.current = null;
    }
    
    // 重置状态
    setEngine(null);
    setIsReady(false);
    cleanupCallbacksRef.current = [];
  }, []);
  
  // 7. 组件卸载清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  return {
    initializeCanvas,
    renderWatermark,
    cleanup,
    getMetrics,
    isReady
  };
};
```

---

## 🧪 测试规范

### 测试框架配置

#### Vitest配置标准

```typescript
// vitest.config.ts - Canvas测试专用配置
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    reporters: ['verbose', 'json'],
    
    // Canvas测试环境配置
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        runScripts: 'dangerously'
      }
    },
    
    // 覆盖率要求
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Canvas核心模块更高要求
        'src/engines/canvas/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // WebWorker模块要求
        'src/workers/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    
    // 并行测试配置
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 2
      }
    },
    
    // Canvas测试超时配置
    testTimeout: 10000, // Canvas操作可能较慢
    hookTimeout: 5000
  }
});
```

### Canvas测试规范

#### Canvas组件测试

```typescript
// ✅ 正确：Canvas组件测试结构
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WatermarkCanvas } from '../WatermarkCanvas';
import { CanvasTestUtils } from '@/test-utils/canvas';

describe('WatermarkCanvas', () => {
  // 1. Canvas测试工具初始化
  let canvasTestUtils: CanvasTestUtils;
  
  beforeEach(() => {
    // 设置Canvas测试环境
    canvasTestUtils = new CanvasTestUtils();
    canvasTestUtils.setupCanvasMocks();
    
    // 模拟WebWorker
    global.Worker = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: vi.fn(),
      onerror: vi.fn()
    }));
  });
  
  afterEach(() => {
    canvasTestUtils.cleanup();
    vi.clearAllMocks();
  });
  
  // 2. 基础渲染测试
  it('renders canvas element correctly', () => {
    const mockFile = canvasTestUtils.createMockImageFile();
    const mockWatermark = canvasTestUtils.createMockWatermark();
    
    render(
      <WatermarkCanvas 
        imageFile={mockFile}
        watermarkConfig={mockWatermark}
      />
    );
    
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });
  
  // 3. Canvas初始化测试
  it('initializes canvas engine correctly', async () => {
    const mockFile = canvasTestUtils.createMockImageFile();
    const mockWatermark = canvasTestUtils.createMockWatermark();
    const onRenderComplete = vi.fn();
    
    render(
      <WatermarkCanvas 
        imageFile={mockFile}
        watermarkConfig={mockWatermark}
        onRenderComplete={onRenderComplete}
      />
    );
    
    await waitFor(() => {
      expect(canvasTestUtils.getCanvasOperationCount('getContext')).toBe(1);
    });
    
    // 验证Canvas初始化参数
    const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
    expect(canvas.getContext('2d')).toBeTruthy();
  });
  
  // 4. 水印渲染测试
  it('renders watermark correctly', async () => {
    const mockFile = canvasTestUtils.createMockImageFile();
    const mockWatermark = canvasTestUtils.createMockWatermark({
      type: 'text',
      content: 'Test Watermark',
      position: { x: 100, y: 100 }
    });
    
    const onRenderComplete = vi.fn();
    
    render(
      <WatermarkCanvas 
        imageFile={mockFile}
        watermarkConfig={mockWatermark}
        onRenderComplete={onRenderComplete}
      />
    );
    
    await waitFor(() => {
      expect(onRenderComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          imageData: expect.any(Object)
        })
      );
    }, { timeout: 5000 });
    
    // 验证Canvas操作
    expect(canvasTestUtils.getCanvasOperationCount('fillText')).toBeGreaterThan(0);
  });
  
  // 5. 性能测试
  it('meets performance benchmarks', async () => {
    const mockFile = canvasTestUtils.createMockImageFile({ size: 1024 * 1024 }); // 1MB
    const mockWatermark = canvasTestUtils.createMockWatermark();
    
    const startTime = performance.now();
    
    render(
      <WatermarkCanvas 
        imageFile={mockFile}
        watermarkConfig={mockWatermark}
        onRenderComplete={() => {
          const endTime = performance.now();
          const processingTime = endTime - startTime;
          
          // 性能基准：1MB文件处理应在2秒内完成
          expect(processingTime).toBeLessThan(2000);
        }}
      />
    );
    
    await waitFor(() => {
      expect(screen.queryByText(/渲染中/)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
  
  // 6. 错误处理测试
  it('handles canvas errors gracefully', async () => {
    const mockFile = canvasTestUtils.createMockImageFile();
    const mockWatermark = canvasTestUtils.createMockWatermark();
    
    // 模拟Canvas错误
    canvasTestUtils.mockCanvasError('getContext', new Error('Canvas not supported'));
    
    render(
      <WatermarkCanvas 
        imageFile={mockFile}
        watermarkConfig={mockWatermark}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Canvas渲染错误/)).toBeInTheDocument();
    });
    
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
  
  // 7. WebWorker集成测试
  it('integrates with WebWorker correctly', async () => {
    const mockFile = canvasTestUtils.createMockImageFile();
    const mockWatermark = canvasTestUtils.createMockWatermark();
    
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((error: ErrorEvent) => void) | null
    };
    
    global.Worker = vi.fn(() => mockWorker);
    
    render(
      <WatermarkCanvas 
        imageFile={mockFile}
        watermarkConfig={mockWatermark}
      />
    );
    
    await waitFor(() => {
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROCESS_WATERMARK',
          imageData: expect.any(Object),
          watermark: mockWatermark
        })
      );
    });
  });
});
```

### 性能测试规范

#### Canvas性能基准测试

```typescript
// Canvas性能基准测试
describe('Canvas Performance Benchmarks', () => {
  let canvasTestUtils: CanvasTestUtils;
  
  beforeEach(() => {
    canvasTestUtils = new CanvasTestUtils();
  });
  
  afterEach(() => {
    canvasTestUtils.cleanup();
  });
  
  // 1. 渲染性能基准
  it('meets rendering performance benchmarks', async () => {
    const testCases = [
      { size: '1MB', width: 1920, height: 1080, expectedTime: 1000 },
      { size: '5MB', width: 3840, height: 2160, expectedTime: 3000 },
      { size: '10MB', width: 7680, height: 4320, expectedTime: 6000 }
    ];
    
    for (const testCase of testCases) {
      const mockFile = canvasTestUtils.createMockImageFile({
        width: testCase.width,
        height: testCase.height
      });
      
      const startTime = performance.now();
      
      const engine = new CanvasRenderingEngine();
      await engine.initialize({ file: mockFile });
      
      const watermark = canvasTestUtils.createMockWatermark();
      await engine.renderWatermark(watermark);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(testCase.expectedTime);
    }
  });
  
  // 2. 内存使用基准
  it('stays within memory limits', async () => {
    const mockFile = canvasTestUtils.createMockImageFile({ size: 10 * 1024 * 1024 });
    
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    const engine = new CanvasRenderingEngine();
    await engine.initialize({ file: mockFile });
    
    const watermark = canvasTestUtils.createMockWatermark();
    await engine.renderWatermark(watermark);
    
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;
    
    // 内存增长不应超过200MB
    expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    
    // 清理后内存应释放
    engine.dispose();
    
    // 强制垃圾回收 (如果支持)
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const cleanupMemory = (performance as any).memory?.usedJSHeapSize || 0;
    expect(cleanupMemory).toBeLessThan(finalMemory);
  });
  
  // 3. Canvas池性能测试
  it('canvas pool performance meets requirements', async () => {
    const canvasPool = new CanvasPool({ maxPoolSize: 10 });
    
    const allocations: HTMLCanvasElement[] = [];
    const startTime = performance.now();
    
    // 分配Canvas实例
    for (let i = 0; i < 20; i++) {
      const canvas = canvasPool.allocateCanvas(800, 600);
      allocations.push(canvas);
    }
    
    const allocationTime = performance.now() - startTime;
    
    // Canvas分配应该很快
    expect(allocationTime).toBeLessThan(100); // 100ms
    
    // 释放Canvas实例
    const releaseStartTime = performance.now();
    
    allocations.forEach(canvas => {
      canvasPool.releaseCanvas(canvas);
    });
    
    const releaseTime = performance.now() - releaseStartTime;
    
    // Canvas释放应该很快
    expect(releaseTime).toBeLessThan(50); // 50ms
    
    // 验证池命中率
    const metrics = canvasPool.getMetrics();
    expect(metrics.hitRate).toBeGreaterThan(0.5); // 命中率应大于50%
  });
});
```

---

## 🔒 错误处理和调试规范

### Canvas错误处理

```typescript
// Canvas专用错误处理系统
class CanvasErrorHandler {
  private errorCollector: ErrorCollector;
  private recoveryStrategies: Map<string, RecoveryStrategy>;
  
  constructor() {
    this.errorCollector = new ErrorCollector();
    this.recoveryStrategies = new Map([
      ['CANVAS_CONTEXT_LOST', new CanvasContextRecoveryStrategy()],
      ['WEBGL_CONTEXT_LOST', new WebGLContextRecoveryStrategy()],
      ['MEMORY_PRESSURE', new MemoryPressureRecoveryStrategy()],
      ['WORKER_TERMINATED', new WorkerRecoveryStrategy()]
    ]);
    
    this.setupCanvasErrorCapture();
  }
  
  private setupCanvasErrorCapture(): void {
    // 全局Canvas错误捕获
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(
      contextId: string,
      options?: any
    ) {
      try {
        const context = originalGetContext.call(this, contextId, options);
        
        if (!context) {
          throw new CanvasError('CONTEXT_CREATION_FAILED', {
            contextId,
            canvas: this,
            options
          });
        }
        
        // 包装Context方法进行错误监控
        if (contextId === '2d') {
          this.wrapCanvas2DContext(context as CanvasRenderingContext2D);
        } else if (contextId === 'webgl' || contextId === 'webgl2') {
          this.wrapWebGLContext(context as WebGLRenderingContext);
        }
        
        return context;
      } catch (error) {
        this.handleCanvasError(error as Error, {
          operation: 'getContext',
          contextId,
          canvas: this
        });
        
        // 尝试恢复
        const recovery = this.recoveryStrategies.get('CANVAS_CONTEXT_LOST');
        if (recovery) {
          return recovery.attempt({ canvas: this, contextId, options });
        }
        
        throw error;
      }
    }.bind(this);
  }
  
  private wrapCanvas2DContext(ctx: CanvasRenderingContext2D): void {
    const methods = [
      'drawImage', 'fillText', 'strokeText', 'putImageData', 
      'getImageData', 'createImageData'
    ];
    
    methods.forEach(methodName => {
      const originalMethod = ctx[methodName as keyof CanvasRenderingContext2D];
      
      if (typeof originalMethod === 'function') {
        (ctx as any)[methodName] = function(...args: any[]) {
          try {
            return originalMethod.apply(this, args);
          } catch (error) {
            this.handleCanvasError(error as Error, {
              operation: methodName,
              context: '2d',
              args
            });
            throw error;
          }
        }.bind(this);
      }
    });
  }
  
  private handleCanvasError(error: Error, context: ErrorContext): void {
    const canvasError = new CanvasError(
      this.categorizeError(error),
      context,
      error
    );
    
    // 记录错误
    this.errorCollector.record(canvasError);
    
    // 触发监控告警
    if (this.isCriticalError(canvasError)) {
      this.triggerAlert(canvasError);
    }
  }
  
  private categorizeError(error: Error): CanvasErrorType {
    if (error.message.includes('context lost')) {
      return 'CANVAS_CONTEXT_LOST';
    } else if (error.message.includes('out of memory')) {
      return 'MEMORY_PRESSURE';
    } else if (error.message.includes('invalid operation')) {
      return 'INVALID_OPERATION';
    } else if (error.message.includes('security')) {
      return 'SECURITY_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }
}
```

### WebWorker错误处理

```typescript
// WebWorker专用错误处理
class WorkerErrorHandler {
  private workerPool: WorkerPool;
  private errorRecovery: WorkerErrorRecovery;
  
  constructor(workerPool: WorkerPool) {
    this.workerPool = workerPool;
    this.errorRecovery = new WorkerErrorRecovery();
    this.setupWorkerErrorHandling();
  }
  
  private setupWorkerErrorHandling(): void {
    // 监听Worker错误
    this.workerPool.on('worker-error', (error: WorkerError) => {
      this.handleWorkerError(error);
    });
    
    // 监听Worker崩溃
    this.workerPool.on('worker-terminated', (workerId: string) => {
      this.handleWorkerTermination(workerId);
    });
    
    // 监听任务超时
    this.workerPool.on('task-timeout', (task: ProcessingTask) => {
      this.handleTaskTimeout(task);
    });
  }
  
  private async handleWorkerError(error: WorkerError): Promise<void> {
    switch (error.type) {
      case 'SCRIPT_ERROR':
        await this.errorRecovery.handleScriptError(error);
        break;
        
      case 'MEMORY_ERROR':
        await this.errorRecovery.handleMemoryError(error);
        break;
        
      case 'TIMEOUT_ERROR':
        await this.errorRecovery.handleTimeoutError(error);
        break;
        
      case 'COMMUNICATION_ERROR':
        await this.errorRecovery.handleCommunicationError(error);
        break;
        
      default:
        await this.errorRecovery.handleUnknownError(error);
    }
  }
  
  private async handleWorkerTermination(workerId: string): Promise<void> {
    // 记录终止事件
    console.warn(`Worker ${workerId} terminated unexpectedly`);
    
    // 重新分配该Worker的待处理任务
    const pendingTasks = this.workerPool.getPendingTasks(workerId);
    
    for (const task of pendingTasks) {
      try {
        // 重新提交到其他Worker
        await this.workerPool.submitTask(task);
      } catch (error) {
        // 如果重新提交失败，标记任务失败
        task.reject(new Error(`Task failed after worker termination: ${error}`));
      }
    }
    
    // 创建新的Worker替换终止的Worker
    await this.workerPool.replaceWorker(workerId);
  }
}
```

---

## 🚀 性能优化规范

### Canvas内存管理

```typescript
// Canvas内存管理最佳实践
class CanvasMemoryManager {
  private memoryThreshold: number;
  private cleanupInterval: number;
  private memoryMonitor: MemoryMonitor;
  
  constructor(config: MemoryManagerConfig = {}) {
    this.memoryThreshold = config.memoryThreshold || 512 * 1024 * 1024; // 512MB
    this.cleanupInterval = config.cleanupInterval || 30000; // 30秒
    this.memoryMonitor = new MemoryMonitor();
    
    this.startMemoryMonitoring();
  }
  
  private startMemoryMonitoring(): void {
    setInterval(() => {
      this.checkMemoryPressure();
    }, this.cleanupInterval);
    
    // 监听内存压力事件
    if ('memory' in performance) {
      this.monitorHeapUsage();
    }
  }
  
  private checkMemoryPressure(): void {
    const memoryInfo = this.memoryMonitor.getMemoryInfo();
    
    if (memoryInfo.used > this.memoryThreshold) {
      this.triggerMemoryCleanup('HIGH_USAGE');
    }
    
    // 检查Canvas对象数量
    const canvasCount = this.getActiveCanvasCount();
    if (canvasCount > 50) {
      this.triggerMemoryCleanup('TOO_MANY_CANVAS');
    }
  }
  
  private triggerMemoryCleanup(reason: string): void {
    console.warn(`Triggering memory cleanup: ${reason}`);
    
    // 1. 清理Canvas池中的闲置Canvas
    CanvasPool.getInstance().cleanupIdleCanvases();
    
    // 2. 强制垃圾回收（如果支持）
    if (global.gc) {
      global.gc();
    }
    
    // 3. 清理ImageData缓存
    ImageDataCache.getInstance().cleanup();
    
    // 4. 终止闲置的WebWorker
    WorkerPool.getInstance().cleanupIdleWorkers();
    
    // 5. 触发自定义清理事件
    document.dispatchEvent(new CustomEvent('memory-cleanup', {
      detail: { reason, timestamp: Date.now() }
    }));
  }
  
  // Canvas对象池优化
  optimizeCanvasAllocation(width: number, height: number): HTMLCanvasElement {
    const size = width * height * 4; // RGBA
    
    // 检查内存是否充足
    if (this.memoryMonitor.getAvailableMemory() < size * 2) {
      // 内存不足，先清理
      this.triggerMemoryCleanup('INSUFFICIENT_MEMORY');
    }
    
    // 从对象池获取Canvas
    return CanvasPool.getInstance().allocateCanvas(width, height);
  }
  
  // ImageData优化处理
  optimizeImageDataProcessing(imageData: ImageData): ImageData {
    const size = imageData.width * imageData.height * 4;
    
    // 大图片分块处理
    if (size > 16 * 1024 * 1024) { // 16MB
      return this.processImageDataInChunks(imageData);
    }
    
    return imageData;
  }
  
  private processImageDataInChunks(imageData: ImageData): ImageData {
    const chunkSize = 2048; // 2048像素宽度
    const chunks: ImageData[] = [];
    
    for (let x = 0; x < imageData.width; x += chunkSize) {
      const chunkWidth = Math.min(chunkSize, imageData.width - x);
      const chunkData = new ImageData(chunkWidth, imageData.height);
      
      // 复制数据到chunk
      for (let y = 0; y < imageData.height; y++) {
        const sourceStart = (y * imageData.width + x) * 4;
        const targetStart = y * chunkWidth * 4;
        const length = chunkWidth * 4;
        
        chunkData.data.set(
          imageData.data.subarray(sourceStart, sourceStart + length),
          targetStart
        );
      }
      
      chunks.push(chunkData);
    }
    
    // 处理完成后合并chunks
    return this.mergeImageDataChunks(chunks, imageData.width, imageData.height);
  }
}
```

### WebWorker性能优化

```typescript
// WebWorker性能优化策略
class WorkerPerformanceOptimizer {
  private workerPool: WorkerPool;
  private taskScheduler: TaskScheduler;
  private performanceMonitor: WorkerPerformanceMonitor;
  
  constructor() {
    this.workerPool = new WorkerPool({
      minWorkers: 2,
      maxWorkers: navigator.hardwareConcurrency || 4,
      idleTimeout: 30000
    });
    
    this.taskScheduler = new TaskScheduler();
    this.performanceMonitor = new WorkerPerformanceMonitor();
    
    this.optimizeWorkerPerformance();
  }
  
  private optimizeWorkerPerformance(): void {
    // 1. 智能任务调度
    this.taskScheduler.setSchedulingStrategy('load-balance');
    
    // 2. Worker预热
    this.preWarmWorkers();
    
    // 3. 任务批处理
    this.enableTaskBatching();
    
    // 4. 性能监控
    this.startPerformanceMonitoring();
  }
  
  private preWarmWorkers(): void {
    // 预热Worker，避免冷启动延迟
    const warmupTasks = Array.from({ length: this.workerPool.size }, (_, index) => ({
      type: 'warmup',
      id: `warmup-${index}`,
      data: new ArrayBuffer(1024) // 1KB测试数据
    }));
    
    Promise.all(
      warmupTasks.map(task => this.workerPool.submitTask(task))
    ).then(() => {
      console.log('Workers prewarmed successfully');
    });
  }
  
  private enableTaskBatching(): void {
    const taskBuffer: ProcessingTask[] = [];
    const BATCH_SIZE = 5;
    const BATCH_TIMEOUT = 100; // 100ms
    
    let batchTimer: NodeJS.Timeout | null = null;
    
    const processBatch = () => {
      if (taskBuffer.length === 0) return;
      
      const batch = taskBuffer.splice(0, BATCH_SIZE);
      
      // 创建批处理任务
      const batchTask: BatchProcessingTask = {
        type: 'batch',
        tasks: batch,
        id: `batch-${Date.now()}`
      };
      
      // 提交批处理任务
      this.workerPool.submitTask(batchTask);
      
      // 继续处理剩余任务
      if (taskBuffer.length > 0) {
        batchTimer = setTimeout(processBatch, BATCH_TIMEOUT);
      }
    };
    
    // 拦截任务提交，进行批处理
    const originalSubmit = this.workerPool.submitTask.bind(this.workerPool);
    this.workerPool.submitTask = (task: ProcessingTask) => {
      // 小任务加入批处理
      if (this.isSmallTask(task)) {
        taskBuffer.push(task);
        
        if (taskBuffer.length >= BATCH_SIZE) {
          if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
          }
          processBatch();
        } else if (batchTimer === null) {
          batchTimer = setTimeout(processBatch, BATCH_TIMEOUT);
        }
        
        return Promise.resolve(); // 批处理任务的Promise处理
      } else {
        // 大任务直接提交
        return originalSubmit(task);
      }
    };
  }
  
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const metrics = this.performanceMonitor.getMetrics();
      
      // 动态调整Worker数量
      if (metrics.averageUtilization > 0.8 && this.workerPool.size < this.workerPool.maxWorkers) {
        this.workerPool.addWorker();
      } else if (metrics.averageUtilization < 0.3 && this.workerPool.size > this.workerPool.minWorkers) {
        this.workerPool.removeWorker();
      }
      
      // 调整任务调度策略
      if (metrics.averageTaskTime > 5000) { // 5秒
        this.taskScheduler.setSchedulingStrategy('performance-based');
      } else {
        this.taskScheduler.setSchedulingStrategy('load-balance');
      }
      
    }, 10000); // 10秒检查一次
  }
  
  // 任务优先级调度
  scheduleTaskWithPriority(task: ProcessingTask, priority: TaskPriority): Promise<any> {
    const prioritizedTask: PrioritizedTask = {
      ...task,
      priority,
      submittedAt: Date.now()
    };
    
    return this.taskScheduler.scheduleTask(prioritizedTask);
  }
}
```

---

## 📐 代码组织规范

### 项目目录结构

```
src/
├── components/              # React组件
│   ├── ui/                 # 通用UI组件
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   └── Progress/
│   ├── canvas/             # Canvas专用组件
│   │   ├── WatermarkCanvas/
│   │   ├── ImagePreview/
│   │   ├── CanvasControls/
│   │   └── CanvasViewport/
│   └── business/           # 业务组件
│       ├── FileUploader/
│       ├── WatermarkEditor/
│       ├── ResultExporter/
│       └── CertificateValidator/
├── engines/                # 渲染引擎
│   ├── canvas/             # Canvas渲染引擎
│   │   ├── CanvasRenderer.ts
│   │   ├── CanvasPool.ts
│   │   ├── RenderingPipeline.ts
│   │   └── MemoryManager.ts
│   └── crypto/             # 加密引擎
│       ├── CertificateSystem.ts
│       ├── HashGenerator.ts
│       └── CryptoUtils.ts
├── workers/                # WebWorker
│   ├── watermark-processor.worker.ts
│   ├── image-processor.worker.ts
│   ├── crypto-worker.worker.ts
│   └── WorkerPool.ts
├── hooks/                  # 自定义Hooks
│   ├── canvas/             # Canvas相关Hooks
│   │   ├── useCanvas.ts
│   │   ├── useCanvasPool.ts
│   │   └── useCanvasMetrics.ts
│   ├── workers/            # Worker相关Hooks
│   │   ├── useWebWorker.ts
│   │   └── useWorkerPool.ts
│   └── business/           # 业务Hooks
│       ├── useWatermark.ts
│       ├── useFileProcessor.ts
│       └── useCertificate.ts
├── utils/                  # 工具函数
│   ├── canvas/             # Canvas工具
│   │   ├── canvas-utils.ts
│   │   ├── image-utils.ts
│   │   └── drawing-utils.ts
│   ├── performance/        # 性能工具
│   │   ├── metrics.ts
│   │   ├── profiler.ts
│   │   └── memory-monitor.ts
│   └── validation/         # 验证工具
│       ├── file-validator.ts
│       ├── image-validator.ts
│       └── canvas-validator.ts
├── types/                  # TypeScript类型定义
│   ├── canvas.types.ts     # Canvas相关类型
│   ├── worker.types.ts     # Worker相关类型
│   ├── watermark.types.ts  # 水印相关类型
│   └── app.types.ts        # 应用全局类型
├── constants/              # 常量定义
│   ├── canvas.constants.ts # Canvas常量
│   ├── performance.constants.ts
│   └── config.constants.ts
└── __tests__/             # 测试文件
    ├── components/
    ├── engines/
    ├── workers/
    ├── hooks/
    └── utils/
```

### 命名规范

```typescript
// ✅ 正确：Canvas相关命名约定

// 1. 组件命名：PascalCase
const WatermarkCanvas: React.FC = () => {};
const CanvasRenderer: React.FC = () => {};

// 2. Hook命名：camelCase + use前缀
const useCanvasEngine = () => {};
const useWatermarkProcessor = () => {};

// 3. 函数命名：camelCase，动词开头
const renderWatermark = (canvas: HTMLCanvasElement) => {};
const processImageData = (data: ImageData) => ImageData;
const validateCanvasSupport = () => boolean;

// 4. 变量命名：camelCase
const canvasElement = document.createElement('canvas');
const renderingContext = canvas.getContext('2d');
const imageDataBuffer = new ArrayBuffer(1024);

// 5. 常量命名：SCREAMING_SNAKE_CASE
const MAX_CANVAS_SIZE = 8192;
const DEFAULT_CANVAS_CONFIG = {
  width: 800,
  height: 600,
  devicePixelRatio: window.devicePixelRatio || 1
} as const;

const SUPPORTED_IMAGE_FORMATS = ['image/png', 'image/jpeg', 'image/webp'] as const;
const CANVAS_RENDERING_MODES = ['2d', 'webgl', 'webgl2'] as const;

// 6. 类型命名：PascalCase
interface CanvasConfig {
  width: number;
  height: number;
}

type WatermarkType = 'text' | 'image' | 'certificate';
type CanvasRenderingMode = typeof CANVAS_RENDERING_MODES[number];

// 7. 枚举命名：PascalCase
enum ProcessingStage {
  Initializing = 'initializing',
  LoadingImage = 'loading-image',
  RenderingWatermark = 'rendering-watermark',
  GeneratingCertificate = 'generating-certificate',
  Completed = 'completed'
}

// 8. Canvas专用命名模式
class CanvasRenderingEngine {
  private _canvas: HTMLCanvasElement;
  private _context: CanvasRenderingContext2D;
  private _pool: CanvasPool;
  
  // Canvas操作方法
  public initializeCanvas(config: CanvasConfig): void {}
  public renderToCanvas(imageData: ImageData): void {}
  public exportCanvasAsBlob(): Promise<Blob> {}
  
  // 私有辅助方法
  private _setupCanvasContext(): void {}
  private _optimizeCanvasPerformance(): void {}
}
```

---

## 🔧 构建和部署规范

### Vite配置标准

```typescript
// vite.config.ts - 水印产品专用配置
export default defineConfig({
  plugins: [
    react(),
    // WebWorker内联优化
    {
      name: 'inline-workers',
      generateBundle(options, bundle) {
        Object.keys(bundle).forEach(fileName => {
          if (fileName.includes('worker') && fileName.endsWith('.js')) {
            const workerBundle = bundle[fileName];
            const inlineCode = `
              const workerCode = ${JSON.stringify(workerBundle.code)};
              const blob = new Blob([workerCode], { type: 'application/javascript' });
              export default URL.createObjectURL(blob);
            `;
            this.emitFile({
              type: 'asset',
              fileName: fileName.replace('.js', '.inline.js'),
              source: inlineCode
            });
          }
        });
      }
    }
  ],
  
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'canvas-engine': ['./src/engines/canvas'],
          'worker-system': ['./src/workers'],
          'crypto-system': ['./src/engines/crypto']
        }
      }
    },
    
    // Canvas优化配置
    terserOptions: {
      compress: {
        keep_fnames: /Canvas|Worker|Crypto/
      }
    }
  }
});
```

### 环境变量管理

```typescript
// Canvas性能环境变量配置
interface CanvasEnvironmentConfig {
  VITE_CANVAS_MAX_SIZE: string;
  VITE_WORKER_POOL_SIZE: string;
  VITE_MEMORY_THRESHOLD: string;
  VITE_ENABLE_CANVAS_PROFILING: string;
  VITE_ENABLE_WEBGL_ACCELERATION: string;
}

const canvasConfig = {
  MAX_CANVAS_SIZE: parseInt(import.meta.env.VITE_CANVAS_MAX_SIZE || '8192', 10),
  WORKER_POOL_SIZE: parseInt(import.meta.env.VITE_WORKER_POOL_SIZE || '4', 10),
  MEMORY_THRESHOLD: parseInt(import.meta.env.VITE_MEMORY_THRESHOLD || '536870912', 10), // 512MB
  ENABLE_CANVAS_PROFILING: import.meta.env.VITE_ENABLE_CANVAS_PROFILING === 'true',
  ENABLE_WEBGL_ACCELERATION: import.meta.env.VITE_ENABLE_WEBGL_ACCELERATION === 'true'
};
```

---

## 📊 代码质量检查

### ESLint配置

```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    // Canvas专用规则
    "no-unused-vars": ["error", { 
      "varsIgnorePattern": "^(canvas|ctx|context|worker)$" 
    }],
    "@typescript-eslint/no-explicit-any": ["warn", {
      "ignoreRestArgs": true,
      "fixToUnknown": true
    }],
    
    // 性能相关规则
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/rules-of-hooks": "error",
    
    // Canvas最佳实践
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

---

## 📚 文档编写规范

### JSDoc注释标准

```typescript
/**
 * Canvas渲染引擎 - 负责高性能图片水印渲染
 * 
 * @example
 * ```typescript
 * const engine = new CanvasRenderingEngine({
 *   maxCanvasSize: 8192,
 *   enableGPUAcceleration: true
 * });
 * 
 * await engine.initialize(imageFile);
 * const result = await engine.renderWatermark(watermarkConfig);
 * ```
 */
class CanvasRenderingEngine {
  /**
   * 渲染水印到Canvas
   * 
   * @param watermark - 水印配置对象
   * @param watermark.type - 水印类型：文本、图片或证书
   * @param watermark.position - 水印位置坐标
   * @param watermark.style - 水印样式配置
   * @returns 渲染结果包含处理后的ImageData
   * 
   * @throws {CanvasError} 当Canvas上下文丢失时抛出
   * @throws {MemoryError} 当内存不足时抛出
   * 
   * @since 1.0.0
   */
  async renderWatermark(watermark: WatermarkConfig): Promise<RenderResult> {
    // 实现...
  }
}
```

---

**文档版本**: v1.0.0  
**最后更新**: 2025-08-30  
**维护团队**: 水印增强产品开发团队  
**审核状态**: 待审核

*本技术规范文档是水印增强产品开发的基础标准，重点关注Canvas渲染引擎和WebWorker并行处理的技术规范要求。所有团队成员必须严格遵循本规范。*