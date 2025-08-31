/**
 * 独立水印图片生成器 - 方案A核心组件
 * 专门负责将水印转换为高质量图片，与PDF合并分离
 * 
 * 核心特性：
 * 1. 独立的水印图片生成（您的建议）
 * 2. 多种图片格式支持 (PNG, SVG, WebP)
 * 3. 批量生成优化
 * 4. 质量控制和缓存
 */

import { ChineseWatermarkRenderer, type ChineseWatermarkOptions } from '../canvas/ChineseWatermarkRenderer';
import type { WatermarkSettings } from '../../types/watermark.types';

export interface WatermarkImageOptions {
  format: 'png' | 'svg' | 'webp';
  quality: 'draft' | 'normal' | 'high' | 'ultra';
  dpi: 72 | 150 | 300 | 600;
  backgroundColor: 'transparent' | string;
  antiAliasing: boolean;
  compressionLevel: number; // 0-9 for PNG, 0-100 for WebP
}

export interface WatermarkTemplate {
  id: string;
  name: string;
  options: ChineseWatermarkOptions;
  variations?: Array<{
    name: string;
    modifications: Partial<ChineseWatermarkOptions>;
  }>;
}

export interface GeneratedWatermark {
  id: string;
  template: string;
  blob: Blob;
  dataUrl: string;
  dimensions: { width: number; height: number };
  format: string;
  size: number;
  quality: string;
  generationTime: number;
  checksum: string; // 用于缓存
}

export interface BatchGenerationResult {
  successful: GeneratedWatermark[];
  failed: Array<{
    template: string;
    error: string;
  }>;
  totalTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export class WatermarkImageGenerator {
  private static cache = new Map<string, GeneratedWatermark>();
  private static readonly MAX_CACHE_SIZE = 100;
  
  private static readonly DEFAULT_OPTIONS: WatermarkImageOptions = {
    format: 'png',
    quality: 'normal',
    dpi: 150,
    backgroundColor: 'transparent',
    antiAliasing: true,
    compressionLevel: 6
  };

  private static readonly QUALITY_PROFILES = {
    draft: { dpi: 72, antiAliasing: false, compressionLevel: 9 },
    normal: { dpi: 150, antiAliasing: true, compressionLevel: 6 },
    high: { dpi: 300, antiAliasing: true, compressionLevel: 3 },
    ultra: { dpi: 600, antiAliasing: true, compressionLevel: 0 }
  };

  /**
   * 生成独立水印图片 - 方案A核心功能
   */
  static async generateWatermarkImage(
    watermarkOptions: ChineseWatermarkOptions,
    imageOptions: Partial<WatermarkImageOptions> = {}
  ): Promise<GeneratedWatermark> {
    const startTime = performance.now();
    const config = { ...this.DEFAULT_OPTIONS, ...imageOptions };
    
    // 应用质量配置文件
    const qualityProfile = this.QUALITY_PROFILES[config.quality];
    const finalConfig = { ...config, ...qualityProfile };

    console.log('🎨 生成独立水印图片:', {
      watermarkOptions,
      imageConfig: finalConfig
    });

    // 生成缓存键
    const cacheKey = this.generateCacheKey(watermarkOptions, finalConfig);
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      console.log('✅ 水印图片缓存命中');
      return this.cache.get(cacheKey)!;
    }

    try {
      let generatedWatermark: GeneratedWatermark;

      // 根据格式选择生成方法
      switch (finalConfig.format) {
        case 'svg':
          generatedWatermark = await this.generateSVGWatermark(watermarkOptions, finalConfig);
          break;
        case 'webp':
          generatedWatermark = await this.generateWebPWatermark(watermarkOptions, finalConfig);
          break;
        case 'png':
        default:
          generatedWatermark = await this.generatePNGWatermark(watermarkOptions, finalConfig);
          break;
      }

      // 计算生成时间
      generatedWatermark.generationTime = performance.now() - startTime;
      
      // 添加到缓存
      this.addToCache(cacheKey, generatedWatermark);

      console.log('✅ 水印图片生成完成:', {
        format: generatedWatermark.format,
        size: generatedWatermark.size,
        dimensions: generatedWatermark.dimensions,
        generationTime: generatedWatermark.generationTime
      });

      return generatedWatermark;

    } catch (error) {
      console.error('❌ 水印图片生成失败:', error);
      throw error;
    }
  }

  /**
   * 生成PNG格式水印 - 主要方法
   */
  private static async generatePNGWatermark(
    options: ChineseWatermarkOptions,
    config: WatermarkImageOptions
  ): Promise<GeneratedWatermark> {
    // 根据DPI调整尺寸
    const scaleFactor = config.dpi / 72; // 72 DPI 为基准
    const scaledOptions = {
      ...options,
      fontSize: (options.fontSize || 24) * scaleFactor,
      maxWidth: options.maxWidth ? options.maxWidth * scaleFactor : undefined,
      padding: (options.padding || 10) * scaleFactor
    };

    // 创建高质量Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('无法创建Canvas上下文');
    }

    // 设置高质量渲染
    this.configureHighQualityRendering(ctx, config);

    // 计算尺寸
    const dimensions = this.calculateOptimalDimensions(scaledOptions);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // 重新应用设置（Canvas尺寸改变后需要重新设置）
    this.configureHighQualityRendering(ctx, config);

    // 设置背景
    if (config.backgroundColor !== 'transparent') {
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 渲染水印文字
    await this.renderWatermarkText(ctx, scaledOptions, canvas.width, canvas.height);

    // 生成PNG blob
    const blob = await this.canvasToPNGBlob(canvas, config.compressionLevel);
    const dataUrl = URL.createObjectURL(blob);
    const checksum = await this.calculateChecksum(blob);

    return {
      id: this.generateId(),
      template: 'custom',
      blob,
      dataUrl,
      dimensions: { width: canvas.width, height: canvas.height },
      format: 'png',
      size: blob.size,
      quality: config.quality,
      generationTime: 0, // 在外层设置
      checksum
    };
  }

  /**
   * 生成SVG格式水印
   */
  private static async generateSVGWatermark(
    options: ChineseWatermarkOptions,
    config: WatermarkImageOptions
  ): Promise<GeneratedWatermark> {
    const dimensions = this.calculateOptimalDimensions(options);
    
    // 构建SVG内容
    const svg = this.createSVGWatermark(options, dimensions, config);
    
    // 转换为Blob
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const dataUrl = URL.createObjectURL(blob);
    const checksum = await this.calculateChecksum(blob);

    return {
      id: this.generateId(),
      template: 'custom',
      blob,
      dataUrl,
      dimensions,
      format: 'svg',
      size: blob.size,
      quality: config.quality,
      generationTime: 0,
      checksum
    };
  }

  /**
   * 生成WebP格式水印
   */
  private static async generateWebPWatermark(
    options: ChineseWatermarkOptions,
    config: WatermarkImageOptions
  ): Promise<GeneratedWatermark> {
    // 先生成PNG，然后转换为WebP
    const pngResult = await this.generatePNGWatermark(options, { ...config, format: 'png' });
    
    // 检查浏览器是否支持WebP
    if (!this.supportsWebP()) {
      console.warn('浏览器不支持WebP，回退到PNG');
      return { ...pngResult, format: 'webp' };
    }

    // 转换为WebP
    const webpBlob = await this.convertToWebP(pngResult.blob, config.compressionLevel);
    const dataUrl = URL.createObjectURL(webpBlob);
    const checksum = await this.calculateChecksum(webpBlob);

    return {
      ...pngResult,
      blob: webpBlob,
      dataUrl,
      format: 'webp',
      size: webpBlob.size,
      checksum
    };
  }

  /**
   * 批量生成水印图片 - 优化版本
   */
  static async generateBatchWatermarks(
    templates: WatermarkTemplate[],
    imageOptions: Partial<WatermarkImageOptions> = {},
    concurrency: number = 3
  ): Promise<BatchGenerationResult> {
    const startTime = performance.now();
    const successful: GeneratedWatermark[] = [];
    const failed: Array<{ template: string; error: string }> = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    console.log('🔄 开始批量水印图片生成:', {
      templateCount: templates.length,
      concurrency,
      imageOptions
    });

    // 分批并发处理
    for (let i = 0; i < templates.length; i += concurrency) {
      const batch = templates.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (template) => {
        try {
          // 生成主模板
          const mainWatermark = await this.generateWatermarkImage(template.options, imageOptions);
          successful.push({ ...mainWatermark, template: template.id });
          cacheMisses++;

          // 生成变体（如果有）
          if (template.variations) {
            for (const variation of template.variations) {
              const variantOptions = { ...template.options, ...variation.modifications };
              const variantWatermark = await this.generateWatermarkImage(variantOptions, imageOptions);
              successful.push({ 
                ...variantWatermark, 
                template: `${template.id}_${variation.name}`
              });
              cacheMisses++;
            }
          }

        } catch (error) {
          failed.push({
            template: template.id,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      });

      await Promise.all(batchPromises);
      
      console.log(`✅ 批次 ${Math.floor(i / concurrency) + 1} 完成`);
    }

    const totalTime = performance.now() - startTime;

    const result: BatchGenerationResult = {
      successful,
      failed,
      totalTime,
      cacheHits,
      cacheMisses
    };

    console.log('🎉 批量水印生成完成:', {
      成功数量: successful.length,
      失败数量: failed.length,
      总耗时: `${totalTime.toFixed(0)}ms`,
      缓存命中率: `${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}%`
    });

    return result;
  }

  /**
   * 为PDF页面创建完整水印图片集 - 方案A核心功能
   */
  static async generateWatermarkImagesForPDF(
    watermarkSettings: WatermarkSettings,
    pdfDimensions: { width: number; height: number },
    gridConfig: {
      spacingX?: number;
      spacingY?: number;
      layers?: number;
      densityMode?: 'sparse' | 'normal' | 'dense';
    } = {},
    imageOptions: Partial<WatermarkImageOptions> = {}
  ): Promise<Array<GeneratedWatermark & { position: { x: number; y: number }; layer: number }>> {
    console.log('📄 为PDF创建水印图片集:', {
      pdfDimensions,
      gridConfig,
      imageOptions
    });

    const {
      spacingX = 200,
      spacingY = 150,
      layers = 1,
      densityMode = 'normal'
    } = gridConfig;

    // 转换水印设置
    const watermarkOptions = ChineseWatermarkRenderer.convertFromWatermarkSettings(watermarkSettings);

    // 根据密度模式调整间距
    let adjustedSpacingX = spacingX;
    let adjustedSpacingY = spacingY;
    
    switch (densityMode) {
      case 'dense':
        adjustedSpacingX *= 0.7;
        adjustedSpacingY *= 0.7;
        break;
      case 'sparse':
        adjustedSpacingX *= 1.5;
        adjustedSpacingY *= 1.5;
        break;
    }

    const watermarkImages: Array<GeneratedWatermark & { position: { x: number; y: number }; layer: number }> = [];

    // 为每层生成水印
    for (let layer = 0; layer < layers; layer++) {
      const layerOpacity = (watermarkOptions.opacity || 0.5) * (1 - layer * 0.1);
      const layerOptions = {
        ...watermarkOptions,
        opacity: layerOpacity,
        rotation: (watermarkOptions.rotation || 0) + (layer * 15)
      };

      // 计算网格位置
      const margin = 50;
      const effectiveWidth = pdfDimensions.width - 2 * margin;
      const effectiveHeight = pdfDimensions.height - 2 * margin;
      
      const cols = Math.floor(effectiveWidth / adjustedSpacingX) + 1;
      const rows = Math.floor(effectiveHeight / adjustedSpacingY) + 1;

      // 生成该层的水印图片（只生成一个，位置时复用）
      const baseWatermark = await this.generateWatermarkImage(layerOptions, imageOptions);

      // 为每个网格位置创建水印引用
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let x = margin + col * adjustedSpacingX;
          let y = margin + row * adjustedSpacingY;

          // 层级交错
          if (layer > 0) {
            x += (adjustedSpacingX * 0.5 * layer) % adjustedSpacingX;
            y += (adjustedSpacingY * 0.5 * layer) % adjustedSpacingY;
          }

          // 行级交错
          if (row % 2 === 1) {
            x += adjustedSpacingX * 0.5;
          }

          // 确保在边界内
          if (x >= margin && 
              x <= pdfDimensions.width - margin - baseWatermark.dimensions.width &&
              y >= margin && 
              y <= pdfDimensions.height - margin - baseWatermark.dimensions.height) {
            
            watermarkImages.push({
              ...baseWatermark,
              position: { x, y },
              layer
            });
          }
        }
      }
    }

    console.log(`✅ PDF水印图片集创建完成，共${watermarkImages.length}个位置`);
    return watermarkImages;
  }

  // 私有工具方法

  private static configureHighQualityRendering(
    ctx: CanvasRenderingContext2D,
    config: WatermarkImageOptions
  ): void {
    if (config.antiAliasing) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    
    // 针对高DPI显示优化
    if (config.dpi > 150) {
      (ctx as any).textRenderingOptimization = 'optimizeQuality';
    }
  }

  private static calculateOptimalDimensions(
    options: ChineseWatermarkOptions
  ): { width: number; height: number } {
    // 使用已有的估算方法
    return ChineseWatermarkRenderer.estimateTextDimensions(
      options.text,
      options.fontSize || 24,
      options.rotation || 0
    );
  }

  private static async renderWatermarkText(
    ctx: CanvasRenderingContext2D,
    options: ChineseWatermarkOptions,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<void> {
    // 复用现有的渲染逻辑
    const fontString = this.buildFontString(options);
    ctx.font = fontString;

    const radians = ((options.rotation || 0) * Math.PI) / 180;
    const rgbaColor = this.parseColorWithOpacity(options.color || '#000000', options.opacity || 0.5);

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate(radians);
    ctx.fillStyle = rgbaColor;
    ctx.fillText(options.text, 0, 0);
    ctx.restore();
  }

  private static buildFontString(options: ChineseWatermarkOptions): string {
    const weight = options.fontWeight || 'normal';
    const size = options.fontSize || 24;
    const family = options.fontFamily || 'Microsoft YaHei';
    return `${weight} ${size}px "${family}"`;
  }

  private static parseColorWithOpacity(color: string, opacity: number): string {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  private static async canvasToPNGBlob(
    canvas: HTMLCanvasElement,
    compressionLevel: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas转PNG失败'));
      }, 'image/png', 1 - compressionLevel / 10);
    });
  }

  private static createSVGWatermark(
    options: ChineseWatermarkOptions,
    dimensions: { width: number; height: number },
    config: WatermarkImageOptions
  ): string {
    const { width, height } = dimensions;
    const fontSize = options.fontSize || 24;
    const color = options.color || '#000000';
    const opacity = options.opacity || 0.5;
    const rotation = options.rotation || 0;

    return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .watermark-text {
        font-family: "${options.fontFamily || 'Microsoft YaHei'}";
        font-size: ${fontSize}px;
        font-weight: ${options.fontWeight || 'normal'};
        fill: ${color};
        opacity: ${opacity};
        text-anchor: middle;
        dominant-baseline: middle;
      }
    </style>
  </defs>
  <text x="${width/2}" y="${height/2}" 
        class="watermark-text"
        transform="rotate(${rotation} ${width/2} ${height/2})">
    ${options.text}
  </text>
</svg>`.trim();
  }

  private static supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  private static async convertToWebP(pngBlob: Blob, quality: number): Promise<Blob> {
    // WebP转换逻辑（简化版）
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('无法创建Canvas上下文');
    }

    // 加载PNG图片到Canvas
    const img = new Image();
    const imageUrl = URL.createObjectURL(pngBlob);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // 转换为WebP
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('WebP转换失败'));
      }, 'image/webp', quality / 100);
    });
  }

  private static generateCacheKey(
    watermarkOptions: ChineseWatermarkOptions,
    imageOptions: WatermarkImageOptions
  ): string {
    const keyData = {
      text: watermarkOptions.text,
      fontSize: watermarkOptions.fontSize,
      color: watermarkOptions.color,
      opacity: watermarkOptions.opacity,
      rotation: watermarkOptions.rotation,
      format: imageOptions.format,
      quality: imageOptions.quality,
      dpi: imageOptions.dpi
    };
    return btoa(JSON.stringify(keyData));
  }

  private static async calculateChecksum(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  private static addToCache(key: string, watermark: GeneratedWatermark): void {
    // 清理过期缓存
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, watermark);
  }

  /**
   * 清理缓存
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  static getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 0 // 实际应用中需要跟踪命中率
    };
  }
}