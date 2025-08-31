/**
 * Canvas 渲染管线
 * 实现高效的渲染流水线处理
 * 基于架构文档的渲染优化设计
 */

import type {
  RenderOperation,
  RenderResult,
  RenderingMetrics
} from '@/types/canvas.types';
import { CanvasRenderer } from './CanvasRenderer';

export interface PipelineStage<T = any> {
  name: string;
  execute(input: T, context: PipelineContext): Promise<T>;
  validate?(input: T): boolean;
  cleanup?(): void;
}

export interface PipelineContext {
  renderer: CanvasRenderer;
  metrics: RenderingMetrics;
  stage: number;
  totalStages: number;
  cache: Map<string, any>;
  onProgress?: (progress: number) => void;
}

export class RenderingPipeline {
  private readonly _stages: PipelineStage[] = [];
  private readonly _renderer: CanvasRenderer;
  private _context: PipelineContext | null = null;

  constructor(renderer: CanvasRenderer) {
    this._renderer = renderer;
  }

  /**
   * 添加渲染阶段
   */
  addStage<T>(stage: PipelineStage<T>): this {
    this._stages.push(stage);
    return this;
  }

  /**
   * 执行完整的渲染管线
   */
  async execute(operation: RenderOperation): Promise<RenderResult> {
    if (this._stages.length === 0) {
      throw new Error('No pipeline stages configured');
    }

    // 初始化上下文
    this._context = {
      renderer: this._renderer,
      metrics: this._renderer.metrics,
      stage: 0,
      totalStages: this._stages.length,
      cache: new Map(),
      onProgress: operation.onProgress
    };

    const startTime = performance.now();

    try {
      let result: any = operation;

      // 执行每个阶段
      for (let i = 0; i < this._stages.length; i++) {
        const stage = this._stages[i];
        this._context.stage = i;

        // 验证输入（如果定义了验证器）
        if (stage.validate && !stage.validate(result)) {
          throw new Error(`Validation failed at stage: ${stage.name}`);
        }

        // 执行阶段
        result = await stage.execute(result, this._context);

        // 更新进度
        if (this._context.onProgress) {
          const progress = (i + 1) / this._stages.length;
          this._context.onProgress(progress);
        }
      }

      const renderTime = performance.now() - startTime;

      return {
        success: true,
        ...result,
        metrics: {
          ...this._renderer.metrics,
          renderTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? {
          code: 'RENDER_TIMEOUT' as const,
          message: error.message
        } : undefined,
        metrics: {
          ...this._renderer.metrics,
          renderTime: performance.now() - startTime
        }
      };
    } finally {
      // 清理资源
      await this._cleanup();
    }
  }

  /**
   * 清空管线
   */
  clear(): void {
    this._stages.length = 0;
  }

  /**
   * 获取管线信息
   */
  getInfo() {
    return {
      stageCount: this._stages.length,
      stages: this._stages.map(stage => stage.name),
      isConfigured: this._stages.length > 0
    };
  }

  private async _cleanup(): Promise<void> {
    if (this._context) {
      this._context.cache.clear();
    }

    // 清理各阶段资源
    for (const stage of this._stages) {
      if (stage.cleanup) {
        try {
          stage.cleanup();
        } catch (error) {
          console.warn(`Cleanup failed for stage ${stage.name}:`, error);
        }
      }
    }

    this._context = null;
  }
}

// 预定义的渲染阶段

/**
 * 输入验证阶段
 */
export const InputValidationStage: PipelineStage<RenderOperation> = {
  name: 'InputValidation',
  
  validate(input: RenderOperation): boolean {
    return !!(input.source && input.options);
  },
  
  async execute(input: RenderOperation, context: PipelineContext): Promise<RenderOperation> {
    // 验证输入参数
    if (!input.source) {
      throw new Error('Source image is required');
    }

    if (!input.options) {
      throw new Error('Render options are required');
    }

    // 验证图像源
    if (input.source instanceof HTMLImageElement && !input.source.complete) {
      await new Promise((resolve, reject) => {
        input.source.addEventListener('load', resolve);
        input.source.addEventListener('error', reject);
      });
    }

    return input;
  }
};

/**
 * 预处理阶段
 */
export const PreprocessingStage: PipelineStage<RenderOperation> = {
  name: 'Preprocessing',
  
  async execute(input: RenderOperation, context: PipelineContext): Promise<RenderOperation> {
    // 缓存源图像尺寸信息
    const source = input.source;
    let width = 0, height = 0;

    if (source instanceof ImageData) {
      width = source.width;
      height = source.height;
    } else if ('width' in source && 'height' in source) {
      width = source.width;
      height = source.height;
    }

    context.cache.set('sourceSize', { width, height });

    // 预分配 Canvas（如果需要）
    if (width > 0 && height > 0) {
      const workCanvas = context.renderer.pool.acquire(width, height);
      context.cache.set('workCanvas', workCanvas);
    }

    return input;
  }
};

/**
 * 渲染执行阶段
 */
export const RenderExecutionStage: PipelineStage<RenderOperation> = {
  name: 'RenderExecution',
  
  async execute(input: RenderOperation, context: PipelineContext): Promise<RenderResult> {
    return await context.renderer.render(input);
  }
};

/**
 * 后处理阶段
 */
export const PostprocessingStage: PipelineStage<RenderResult> = {
  name: 'Postprocessing',
  
  async execute(input: RenderResult, context: PipelineContext): Promise<RenderResult> {
    if (!input.success || !input.canvas) {
      return input;
    }

    // 应用后处理滤镜
    const canvas = input.canvas;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // 这里可以添加各种后处理效果
      // 例如锐化、降噪等
    }

    return input;
  },
  
  cleanup(): void {
    // 清理后处理资源
  }
};

/**
 * 输出优化阶段
 */
export const OutputOptimizationStage: PipelineStage<RenderResult> = {
  name: 'OutputOptimization',
  
  async execute(input: RenderResult, context: PipelineContext): Promise<RenderResult> {
    if (!input.success || !input.canvas) {
      return input;
    }

    // 优化输出格式和质量
    const canvas = input.canvas;
    
    // 根据内容自动选择最佳格式
    // 例如：透明内容使用 PNG，照片使用 JPEG
    
    return input;
  }
};

/**
 * 创建标准水印渲染管线
 */
export function createWatermarkPipeline(renderer: CanvasRenderer): RenderingPipeline {
  return new RenderingPipeline(renderer)
    .addStage(InputValidationStage)
    .addStage(PreprocessingStage)
    .addStage(RenderExecutionStage)
    .addStage(PostprocessingStage)
    .addStage(OutputOptimizationStage);
}

/**
 * 创建高性能批处理管线
 */
export function createBatchProcessingPipeline(renderer: CanvasRenderer): RenderingPipeline {
  return new RenderingPipeline(renderer)
    .addStage(InputValidationStage)
    .addStage(PreprocessingStage)
    .addStage(RenderExecutionStage);
}