/**
 * 水印处理器核心实现
 * 整合 Canvas 渲染引擎、WebWorker 和加密系统
 * 基于架构文档的水印处理设计
 */

import type {
  WatermarkProcessor as IWatermarkProcessor,
  WatermarkSettings,
  WatermarkResult,
  ValidationResult,
  ProcessingMetadata,
  ProcessedImageData
} from '@/types/watermark.types';
import type { CertificateData } from '@/types/worker.types';

import { CanvasRenderer } from '@/engines/canvas/CanvasRenderer';
import { WorkerPool } from '@/workers/WorkerPool';
import { CertificateSystem } from '@/engines/crypto/CertificateSystem';

export class WatermarkProcessor implements IWatermarkProcessor {
  private _canvasRenderer: CanvasRenderer;
  private _workerPool: WorkerPool;
  private _certificateSystem: CertificateSystem;
  private _initialized = false;

  constructor() {
    this._canvasRenderer = new CanvasRenderer();
    this._workerPool = new WorkerPool(navigator.hardwareConcurrency || 4);
    this._certificateSystem = new CertificateSystem();
  }

  /**
   * 初始化处理器
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // 创建临时 Canvas 用于初始化渲染引擎
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    
    await this._canvasRenderer.initialize(tempCanvas);
    this._initialized = true;

    console.log('Watermark processor initialized');
  }

  /**
   * 处理水印
   */
  async process(image: File, settings: WatermarkSettings): Promise<WatermarkResult> {
    if (!this._initialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    
    try {
      // 验证输入
      this._validateInput(image, settings);

      // 加载图像数据
      const imageData = await this._loadImageData(image);
      
      // 根据设置选择处理策略
      const processedImage = await this._processWithStrategy(imageData, image, settings);
      
      // 生成处理元数据
      const metadata = this._generateMetadata(settings, startTime, image, processedImage);
      
      // 生成证书（如果启用）
      let certificate: CertificateData | undefined;
      if (settings.security.generateCertificate) {
        const result: WatermarkResult = {
          success: true,
          originalFile: image,
          processedImage,
          metadata,
          certificate: undefined
        };
        
        certificate = await this._certificateSystem.generateCertificate(result);
      }

      return {
        success: true,
        originalFile: image,
        processedImage,
        certificate,
        metadata
      };
    } catch (error) {
      return {
        success: false,
        originalFile: image,
        processedImage: this._createErrorImageData(),
        metadata: this._generateErrorMetadata(settings, startTime, error),
        error: {
          code: 'PROCESSING_FAILED' as any,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * 验证水印结果
   */
  async validate(result: WatermarkResult): Promise<ValidationResult> {
    if (!result.success || !result.processedImage.blob) {
      return {
        isValid: false,
        tamperDetected: true,
        confidence: 0,
        validationTime: 0,
        errors: ['Invalid watermark result']
      };
    }

    const startTime = performance.now();

    try {
      let isValid = true;
      let tamperDetected = false;
      const errors: string[] = [];

      // 验证证书（如果存在）
      if (result.certificate) {
        const certificateValidation = await this._certificateSystem.validateCertificate(
          result.certificate,
          result.processedImage.blob
        );

        if (!certificateValidation.isValid) {
          isValid = false;
          tamperDetected = certificateValidation.details.tamperDetected;
          errors.push(...certificateValidation.errors);
        }
      }

      // 验证图像完整性
      const integrityCheck = await this._verifyImageIntegrity(result);
      if (!integrityCheck.valid) {
        isValid = false;
        tamperDetected = true;
        errors.push(...integrityCheck.errors);
      }

      // 计算置信度
      const confidence = this._calculateValidationConfidence(result, isValid, errors.length);

      return {
        isValid,
        certificate: result.certificate,
        tamperDetected,
        confidence,
        validationTime: performance.now() - startTime,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        tamperDetected: true,
        confidence: 0,
        validationTime: performance.now() - startTime,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * 生成证书
   */
  async generateCertificate(result: WatermarkResult): Promise<CertificateData> {
    if (!result.success) {
      throw new Error('Cannot generate certificate for failed watermark result');
    }

    return this._certificateSystem.generateCertificate(result);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this._canvasRenderer) {
      this._canvasRenderer.dispose();
    }
    
    if (this._workerPool) {
      this._workerPool.terminate();
    }

    this._initialized = false;
    console.log('Watermark processor disposed');
  }

  private _validateInput(image: File, settings: WatermarkSettings): void {
    // 验证文件类型
    if (!image.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // 验证文件大小
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (image.size > maxSize) {
      throw new Error(`File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`);
    }

    // 验证水印设置
    if (!settings.type || !['text', 'image', 'hybrid'].includes(settings.type)) {
      throw new Error('Invalid watermark type');
    }

    if (settings.position.opacity < 0 || settings.position.opacity > 1) {
      throw new Error('Opacity must be between 0 and 1');
    }

    if (settings.position.scale < 0.1 || settings.position.scale > 2) {
      throw new Error('Scale must be between 0.1 and 2');
    }
  }

  private async _loadImageData(image: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Cannot create canvas context'));
        return;
      }

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(image);
    });
  }

  private async _processWithStrategy(
    imageData: ImageData,
    originalFile: File,
    settings: WatermarkSettings
  ): Promise<ProcessedImageData> {
    // 根据图像大小和复杂度选择处理策略
    const imageSize = imageData.width * imageData.height;
    const isLargeImage = imageSize > 2048 * 2048; // 4MP
    const isComplexWatermark = settings.type === 'hybrid' || 
                              (settings.type === 'image' && settings.image) ||
                              (settings.position.placement === 'pattern');

    if (isLargeImage || isComplexWatermark) {
      // 使用 WebWorker 并行处理
      return this._processWithWorker(imageData, originalFile, settings);
    } else {
      // 使用主线程处理
      return this._processWithCanvas(imageData, originalFile, settings);
    }
  }

  private async _processWithCanvas(
    imageData: ImageData,
    _originalFile: File,
    settings: WatermarkSettings
  ): Promise<ProcessedImageData> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    await this._canvasRenderer.initialize(canvas);

    const renderResult = await this._canvasRenderer.render({
      type: 'watermark',
      source: imageData,
      watermark: this._convertToCanvasWatermarkConfig(settings),
      options: {
        quality: settings.output.quality,
        format: settings.output.format as 'png' | 'jpeg' | 'webp'
      }
    });

    if (!renderResult.success || !renderResult.blob) {
      throw new Error('Canvas rendering failed');
    }

    return {
      blob: renderResult.blob,
      dataUrl: renderResult.dataUrl || '',
      dimensions: { width: canvas.width, height: canvas.height },
      format: settings.output.format,
      size: renderResult.blob.size
    };
  }

  private async _processWithWorker(
    imageData: ImageData,
    _originalFile: File,
    settings: WatermarkSettings
  ): Promise<ProcessedImageData> {
    const task = {
      id: `watermark-${Date.now()}`,
      type: 'watermark' as const,
      data: {
        imageData,
        watermarkConfig: this._convertToWorkerWatermarkConfig(settings),
        options: {
          quality: settings.output.quality,
          format: settings.output.format
        }
      },
      priority: 'normal' as const,
      timeout: 60000 // 60 seconds
    };

    const result = await this._workerPool.execute(task);

    if (!result.success || !result.data?.blob) {
      throw new Error('Worker processing failed');
    }

    return {
      blob: result.data.blob,
      dataUrl: URL.createObjectURL(result.data.blob),
      dimensions: (result.data as any).dimensions || { width: 0, height: 0 },
      format: (result.data as any).format || 'png',
      size: result.data.blob.size
    };
  }

  private _convertToCanvasWatermarkConfig(settings: WatermarkSettings): any {
    return {
      text: settings.text?.content,
      image: null, // 需要预加载图像
      position: {
        x: this._calculatePosition(settings.position.placement, 'x'),
        y: this._calculatePosition(settings.position.placement, 'y'),
        offsetX: settings.position.margin.left,
        offsetY: settings.position.margin.top
      },
      opacity: settings.position.opacity,
      scale: settings.position.scale,
      rotation: settings.position.rotation,
      blendMode: settings.position.blendMode
    };
  }

  private _convertToWorkerWatermarkConfig(settings: WatermarkSettings): any {
    return {
      text: settings.text?.content,
      image: null, // 需要转换为 ImageData
      position: {
        x: this._calculatePosition(settings.position.placement, 'x'),
        y: this._calculatePosition(settings.position.placement, 'y')
      },
      opacity: settings.position.opacity,
      scale: settings.position.scale,
      rotation: settings.position.rotation
    };
  }

  private _calculatePosition(placement: string, axis: 'x' | 'y'): number | string {
    // 简化的位置计算
    switch (placement) {
      case 'corner':
        return axis === 'x' ? 'right' : 'bottom';
      case 'center':
        return axis === 'x' ? 'center' : 'middle';
      default:
        return axis === 'x' ? 'center' : 'middle';
    }
  }

  private _generateMetadata(
    settings: WatermarkSettings,
    startTime: number,
    originalFile: File,
    processedImage: ProcessedImageData
  ): ProcessingMetadata {
    const processingTime = performance.now() - startTime;
    const compressionRatio = originalFile.size / processedImage.size;
    
    return {
      processingTime,
      memoryPeak: 0, // 需要实际监控
      compressionRatio,
      qualityScore: this._calculateQualityScore(settings, compressionRatio),
      watermarkCount: 1, // 简化实现
      settings,
      timestamp: Date.now()
    };
  }

  private _generateErrorMetadata(
    settings: WatermarkSettings,
    startTime: number,
    _error: any
  ): ProcessingMetadata {
    return {
      processingTime: performance.now() - startTime,
      memoryPeak: 0,
      compressionRatio: 1,
      qualityScore: 0,
      watermarkCount: 0,
      settings,
      timestamp: Date.now()
    };
  }

  private _createErrorImageData(): ProcessedImageData {
    return {
      blob: new Blob(),
      dataUrl: '',
      dimensions: { width: 0, height: 0 },
      format: 'png',
      size: 0
    };
  }

  private _calculateQualityScore(settings: WatermarkSettings, compressionRatio: number): number {
    // 简化的质量评分算法
    let score = settings.output.quality;
    
    // 压缩比影响
    if (compressionRatio > 2) score -= 0.1;
    if (compressionRatio > 4) score -= 0.1;
    
    // 水印透明度影响
    if (settings.position.opacity < 0.3) score -= 0.05;
    
    return Math.max(0, Math.min(1, score));
  }

  private async _verifyImageIntegrity(result: WatermarkResult): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // 基本完整性检查
      if (!result.processedImage.blob || result.processedImage.blob.size === 0) {
        errors.push('Processed image data is empty');
      }

      if (result.processedImage.dimensions.width <= 0 || result.processedImage.dimensions.height <= 0) {
        errors.push('Invalid image dimensions');
      }

      // 格式验证
      const expectedType = `image/${result.processedImage.format}`;
      if (result.processedImage.blob.type !== expectedType) {
        errors.push(`Format mismatch: expected ${expectedType}, got ${result.processedImage.blob.type}`);
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Integrity check error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private _calculateValidationConfidence(
    result: WatermarkResult,
    isValid: boolean,
    errorCount: number
  ): number {
    let confidence = isValid ? 1.0 : 0.0;
    
    // 根据错误数量调整置信度
    confidence -= errorCount * 0.1;
    
    // 根据证书存在性调整
    if (result.certificate) {
      confidence += 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
}