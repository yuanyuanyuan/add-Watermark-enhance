/**
 * 中文水印Canvas渲染器
 * 基于用户提供的技术方案实现：Canvas渲染中文文本 -> PNG -> 嵌入PDF
 * 解决PDF原生中文字体支持限制的问题
 */

import type { WatermarkSettings } from '../../types/watermark.types';

export interface ChineseWatermarkOptions {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  fontFamily?: string;
  fontWeight?: string;
  maxWidth?: number;
  padding?: number;
}

export interface WatermarkImageResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  blob: Blob;
  dimensions: {
    width: number;
    height: number;
  };
}

export class ChineseWatermarkRenderer {
  private static readonly DEFAULT_FONT_FAMILIES = [
    'Microsoft YaHei',
    'SimSun',
    'PingFang SC',
    'Hiragino Sans GB',
    'WenQuanYi Micro Hei',
    'Noto Sans CJK SC',
    'Source Han Sans SC',
    'sans-serif'
  ];

  private static readonly DEFAULT_OPTIONS: Partial<ChineseWatermarkOptions> = {
    fontSize: 24,
    color: '#000000',
    opacity: 0.5,
    rotation: 0,
    fontFamily: 'Microsoft YaHei',
    fontWeight: 'normal',
    padding: 10
  };

  /**
   * 检测文本是否包含中文字符
   */
  static containsChineseCharacters(text: string): boolean {
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text);
  }

  /**
   * 创建中文水印图像
   * 核心技术突破：Canvas渲染 + PNG嵌入技术
   */
  static async createChineseWatermarkImage(
    options: ChineseWatermarkOptions
  ): Promise<WatermarkImageResult> {
    // 合并默认选项
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log('🎨 创建中文水印图像:', {
      text: config.text,
      fontSize: config.fontSize,
      color: config.color,
      opacity: config.opacity,
      rotation: config.rotation,
      containsChinese: this.containsChineseCharacters(config.text || '')
    });

    // 创建Canvas进行中文渲染
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('无法创建Canvas渲染上下文');
    }

    // 设置中文字体 - 关键创新点
    const fontString = this.buildFontString(config);
    ctx.font = fontString;

    console.log('🔤 字体配置:', {
      fontString,
      availableFonts: this.DEFAULT_FONT_FAMILIES,
      textMetrics: 'calculating...'
    });

    // 动态计算文本尺寸和旋转边界框
    const metrics = ctx.measureText(config.text || '');
    const textWidth = metrics.width;
    const textHeight = config.fontSize || 24;

    // 计算旋转后的边界框
    const radians = ((config.rotation || 0) * Math.PI) / 180;
    const rotatedWidth = Math.abs(textWidth * Math.cos(radians)) + Math.abs(textHeight * Math.sin(radians));
    const rotatedHeight = Math.abs(textWidth * Math.sin(radians)) + Math.abs(textHeight * Math.cos(radians));

    // 设置Canvas尺寸（包含边距和旋转空间）
    const padding = config.padding || 10;
    canvas.width = Math.ceil(rotatedWidth + 2 * padding);
    canvas.height = Math.ceil(rotatedHeight + 2 * padding);

    console.log('📏 Canvas尺寸计算:', {
      textDimensions: { width: textWidth, height: textHeight },
      rotation: config.rotation,
      rotatedDimensions: { width: rotatedWidth, height: rotatedHeight },
      canvasDimensions: { width: canvas.width, height: canvas.height },
      padding
    });

    // 重新设置字体（Canvas尺寸改变后需要重新设置）
    ctx.font = fontString;
    
    // 设置文本渲染质量
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    
    // 启用抗锯齿
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 移动到Canvas中心
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // 应用旋转
    if (config.rotation) {
      ctx.rotate(radians);
    }

    // 设置带透明度的颜色
    const rgbaColor = this.parseColorWithOpacity(config.color || '#000000', config.opacity || 0.5);
    ctx.fillStyle = rgbaColor;

    console.log('🎨 渲染参数:', {
      fillStyle: rgbaColor,
      textAlign: ctx.textAlign,
      textBaseline: ctx.textBaseline,
      transform: ctx.getTransform(),
      smoothing: ctx.imageSmoothingEnabled
    });

    // 绘制文本
    ctx.fillText(config.text || '', 0, 0);

    // 可选：添加描边效果
    if (config.opacity && config.opacity < 0.8) {
      ctx.strokeStyle = rgbaColor;
      ctx.lineWidth = 0.5;
      ctx.strokeText(config.text || '', 0, 0);
    }

    // 转换为PNG并生成结果
    const dataUrl = canvas.toDataURL('image/png');
    const blob = await this.canvasToBlob(canvas, 'image/png');

    const result: WatermarkImageResult = {
      canvas,
      dataUrl,
      blob,
      dimensions: {
        width: canvas.width,
        height: canvas.height
      }
    };

    console.log('✅ 中文水印图像创建完成:', {
      dataUrlLength: dataUrl.length,
      blobSize: blob.size,
      dimensions: result.dimensions
    });

    return result;
  }

  /**
   * 为PDF创建多个中文水印图像（网格状分布）
   */
  static async createGridWatermarkImages(
    options: ChineseWatermarkOptions,
    pageWidth: number,
    pageHeight: number,
    gridConfig: {
      spacingX?: number;
      spacingY?: number;
      offsetX?: number;
      offsetY?: number;
      stagger?: boolean;
    } = {}
  ): Promise<Array<WatermarkImageResult & { position: { x: number; y: number } }>> {
    const {
      spacingX = 200,
      spacingY = 150,
      offsetX = 0,
      offsetY = 0,
      stagger = false
    } = gridConfig;

    const results: Array<WatermarkImageResult & { position: { x: number; y: number } }> = [];

    // 计算网格位置
    const margin = 50;
    const cols = Math.floor((pageWidth - 2 * margin) / spacingX) + 1;
    const rows = Math.floor((pageHeight - 2 * margin) / spacingY) + 1;

    console.log('🔲 创建网格水印:', {
      pageSize: { width: pageWidth, height: pageHeight },
      grid: { cols, rows },
      spacing: { x: spacingX, y: spacingY },
      offset: { x: offsetX, y: offsetY },
      stagger,
      totalWatermarks: cols * rows
    });

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let x = margin + col * spacingX + offsetX;
        let y = margin + row * spacingY + offsetY;

        // 交错排列：奇数行偏移
        if (stagger && row % 2 === 1) {
          x += spacingX / 2;
        }

        // 确保位置在页面范围内
        if (x >= margin && x <= pageWidth - margin && 
            y >= margin && y <= pageHeight - margin) {
          
          // 为每个位置创建稍微不同的水印（可选：调整透明度）
          const positionOptions = {
            ...options,
            opacity: (options.opacity || 0.5) * (row % 2 === 0 ? 1.0 : 0.8)
          };

          const watermark = await this.createChineseWatermarkImage(positionOptions);
          results.push({
            ...watermark,
            position: { x, y }
          });
        }
      }
    }

    console.log(`✅ 网格水印创建完成，共 ${results.length} 个水印`);
    return results;
  }

  /**
   * 将Canvas转换为Blob
   */
  private static canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas转Blob失败'));
        }
      }, type);
    });
  }

  /**
   * 构建字体字符串
   */
  private static buildFontString(config: ChineseWatermarkOptions): string {
    const weight = config.fontWeight || 'normal';
    const size = config.fontSize || 24;
    const families = config.fontFamily 
      ? [config.fontFamily, ...this.DEFAULT_FONT_FAMILIES]
      : this.DEFAULT_FONT_FAMILIES;

    // 构建字体回退链
    const fontFamily = families.map(family => 
      family.includes(' ') ? `"${family}"` : family
    ).join(', ');

    return `${weight} ${size}px ${fontFamily}`;
  }

  /**
   * 解析颜色并添加透明度
   */
  private static parseColorWithOpacity(color: string, opacity: number): string {
    // 移除#号
    const hex = color.replace('#', '');
    
    // 解析RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * 从WatermarkSettings转换为ChineseWatermarkOptions
   */
  static convertFromWatermarkSettings(settings: WatermarkSettings): ChineseWatermarkOptions {
    const textColor = typeof settings.text?.color === 'string' 
      ? settings.text.color 
      : settings.text?.color?.primary || '#000000';

    return {
      text: settings.text?.content || 'WATERMARK',
      fontSize: (settings.text?.font?.size || 24) * settings.position.scale,
      color: textColor,
      opacity: settings.position.opacity,
      rotation: settings.position.rotation || 0,
      fontFamily: settings.text?.font?.family,
      fontWeight: settings.text?.font?.weight || 'normal'
    };
  }

  /**
   * 估算文本渲染尺寸（用于布局预计算）
   */
  static estimateTextDimensions(
    text: string,
    fontSize: number,
    rotation: number = 0
  ): { width: number; height: number } {
    // 创建临时Canvas进行测量
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) {
      // 回退计算
      const width = text.length * fontSize * 0.6;
      const height = fontSize;
      return { width, height };
    }

    tempCtx.font = `${fontSize}px ${this.DEFAULT_FONT_FAMILIES[0]}`;
    const metrics = tempCtx.measureText(text);
    
    const textWidth = metrics.width;
    const textHeight = fontSize;

    // 计算旋转后尺寸
    const radians = (rotation * Math.PI) / 180;
    const rotatedWidth = Math.abs(textWidth * Math.cos(radians)) + Math.abs(textHeight * Math.sin(radians));
    const rotatedHeight = Math.abs(textWidth * Math.sin(radians)) + Math.abs(textHeight * Math.cos(radians));

    return {
      width: Math.ceil(rotatedWidth),
      height: Math.ceil(rotatedHeight)
    };
  }

  /**
   * 为PDF创建网格水印 - 核心增强功能
   * 支持200px间距、多层布局、交错排列
   */
  static async createGridWatermarkForPDF(
    options: ChineseWatermarkOptions,
    pdfPageDimensions: { width: number; height: number },
    gridSettings: {
      spacingX?: number;
      spacingY?: number;
      layers?: number;
      staggerOffset?: number;
      densityMode?: 'normal' | 'dense' | 'sparse';
      boundaryMargin?: number;
    } = {}
  ): Promise<{
    watermarkData: Array<{
      imageData: string;
      position: { x: number; y: number };
      layer: number;
      opacity: number;
    }>;
    stats: {
      totalWatermarks: number;
      layers: number;
      coverage: number;
      renderTime: number;
    };
  }> {
    const startTime = performance.now();
    
    const {
      spacingX = 200,
      spacingY = 150,
      layers = 1,
      staggerOffset = 0.5,
      densityMode = 'normal',
      boundaryMargin = 50
    } = gridSettings;

    console.log('🔲 开始创建PDF网格水印:', {
      options,
      pdfPageDimensions,
      gridSettings,
      containsChinese: this.containsChineseCharacters(options.text)
    });

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

    const watermarkData: Array<{
      imageData: string;
      position: { x: number; y: number };
      layer: number;
      opacity: number;
    }> = [];

    // 为每一层创建水印
    for (let layer = 0; layer < layers; layer++) {
      const layerOpacity = (options.opacity || 0.5) * (1 - layer * 0.1);
      const layerOptions = {
        ...options,
        opacity: layerOpacity,
        rotation: (options.rotation || 0) + (layer * 15) // 每层旋转角度稍有不同
      };

      // 计算当前层的网格布局
      const effectiveWidth = pdfPageDimensions.width - 2 * boundaryMargin;
      const effectiveHeight = pdfPageDimensions.height - 2 * boundaryMargin;
      
      const cols = Math.floor(effectiveWidth / adjustedSpacingX) + 1;
      const rows = Math.floor(effectiveHeight / adjustedSpacingY) + 1;

      console.log(`🔲 Layer ${layer + 1}:`, {
        cols,
        rows,
        spacing: { x: adjustedSpacingX, y: adjustedSpacingY },
        opacity: layerOpacity
      });

      // 创建基础水印图像
      const baseWatermark = await this.createChineseWatermarkImage(layerOptions);
      
      // 为当前层的每个位置创建水印
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let x = boundaryMargin + col * adjustedSpacingX;
          let y = boundaryMargin + row * adjustedSpacingY;

          // 层级交错：每层有不同的偏移模式
          if (layer > 0) {
            x += (adjustedSpacingX * staggerOffset * layer) % adjustedSpacingX;
            y += (adjustedSpacingY * staggerOffset * layer) % adjustedSpacingY;
          }

          // 行级交错：奇数行偏移
          if (row % 2 === 1) {
            x += adjustedSpacingX * 0.5;
          }

          // 确保水印在页面边界内
          if (x >= boundaryMargin && 
              x <= pdfPageDimensions.width - boundaryMargin - baseWatermark.dimensions.width &&
              y >= boundaryMargin && 
              y <= pdfPageDimensions.height - boundaryMargin - baseWatermark.dimensions.height) {
            
            watermarkData.push({
              imageData: baseWatermark.dataUrl,
              position: { x, y },
              layer,
              opacity: layerOpacity
            });
          }
        }
      }
    }

    const renderTime = performance.now() - startTime;
    const coverage = (watermarkData.length * 
      this.estimateTextDimensions(options.text, options.fontSize).width * 
      this.estimateTextDimensions(options.text, options.fontSize).height) / 
      (pdfPageDimensions.width * pdfPageDimensions.height);

    const result = {
      watermarkData,
      stats: {
        totalWatermarks: watermarkData.length,
        layers,
        coverage,
        renderTime
      }
    };

    console.log('✅ PDF网格水印创建完成:', result.stats);
    return result;
  }

  /**
   * 智能字体检测和回退机制
   * 确保中文字符在不同平台上的最佳显示效果
   */
  static detectOptimalChineseFont(testText: string = '中文测试'): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return this.DEFAULT_FONT_FAMILIES[0];
    }

    // 测试每种字体的渲染效果
    const fontScores: Array<{ font: string; score: number }> = [];
    
    for (const font of this.DEFAULT_FONT_FAMILIES) {
      try {
        ctx.font = `24px "${font}"`;
        const metrics = ctx.measureText(testText);
        
        // 评分标准：宽度合理性 + 字体可用性
        let score = 0;
        
        // 中文字符的理想宽度应该接近字体大小
        const expectedWidth = testText.length * 24 * 0.8;
        const widthRatio = Math.min(metrics.width, expectedWidth) / Math.max(metrics.width, expectedWidth);
        score += widthRatio * 50;
        
        // 字体家族优先级评分
        const priorityIndex = this.DEFAULT_FONT_FAMILIES.indexOf(font);
        score += (this.DEFAULT_FONT_FAMILIES.length - priorityIndex) * 10;
        
        fontScores.push({ font, score });
        
      } catch (error) {
        // 字体不可用
        fontScores.push({ font, score: 0 });
      }
    }
    
    // 选择评分最高的字体
    fontScores.sort((a, b) => b.score - a.score);
    const optimalFont = fontScores[0]?.font || this.DEFAULT_FONT_FAMILIES[0];
    
    console.log('🔤 字体检测结果:', {
      testText,
      fontScores: fontScores.slice(0, 3),
      selectedFont: optimalFont
    });
    
    return optimalFont;
  }

  /**
   * 增强的Canvas渲染质量控制
   * 针对中文字符进行专门优化
   */
  static enhanceCanvasRenderingQuality(
    ctx: CanvasRenderingContext2D,
    options: {
      antiAliasing?: boolean;
      subpixelRendering?: boolean;
      hinting?: boolean;
    } = {}
  ): void {
    const { antiAliasing = true, subpixelRendering = true, hinting = true } = options;
    
    // 启用高质量渲染
    if (antiAliasing) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    
    // 文本渲染优化
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    
    // 中文字符专用设置
    if (subpixelRendering) {
      // 启用亚像素渲染（某些浏览器支持）
      (ctx as any).textRenderingOptimization = 'optimizeQuality';
    }
    
    console.log('🎨 Canvas渲染质量增强完成:', {
      antiAliasing,
      subpixelRendering,
      hinting,
      smoothingEnabled: ctx.imageSmoothingEnabled,
      smoothingQuality: ctx.imageSmoothingQuality
    });
  }

  /**
   * 批量创建多样化水印
   * 为大批量处理优化的版本
   */
  static async createBatchWatermarks(
    baseOptions: ChineseWatermarkOptions,
    variations: Array<{
      textVariant?: string;
      opacityMultiplier?: number;
      rotationOffset?: number;
      sizeMultiplier?: number;
    }>,
    concurrencyLimit: number = 5
  ): Promise<WatermarkImageResult[]> {
    console.log('🔄 开始批量创建水印:', {
      baseOptions,
      variationCount: variations.length,
      concurrencyLimit
    });

    const results: WatermarkImageResult[] = [];
    
    // 分批并发处理
    for (let i = 0; i < variations.length; i += concurrencyLimit) {
      const batch = variations.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (variation) => {
        const variantOptions: ChineseWatermarkOptions = {
          ...baseOptions,
          text: variation.textVariant || baseOptions.text,
          opacity: (baseOptions.opacity || 0.5) * (variation.opacityMultiplier || 1),
          rotation: (baseOptions.rotation || 0) + (variation.rotationOffset || 0),
          fontSize: (baseOptions.fontSize || 24) * (variation.sizeMultiplier || 1)
        };
        
        return await this.createChineseWatermarkImage(variantOptions);
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`✅ 批次 ${Math.floor(i / concurrencyLimit) + 1} 完成，共 ${batchResults.length} 个水印`);
    }
    
    console.log(`🎉 批量水印创建完成，总计 ${results.length} 个`);
    return results;
  }
}