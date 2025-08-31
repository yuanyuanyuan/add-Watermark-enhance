/**
 * PDF图层水印叠加器
 * 核心策略：在现有PDF上叠加水印图层，不修改原始内容
 * 
 * 叠加模式：
 * 1. 背景层叠加 - 水印在内容下方
 * 2. 前景层叠加 - 水印在内容上方
 * 3. 混合层叠加 - 水印与内容混合
 * 4. 多层叠加 - 多个水印层组合
 */

import { ChineseWatermarkRenderer } from '../../engines/canvas/ChineseWatermarkRenderer';
import { LibraryLoader } from '../cdn/LibraryLoader';
import type { WatermarkSettings } from '../../types/watermark.types';

export interface WatermarkOverlayOptions {
  mode: 'background' | 'foreground' | 'mixed' | 'multilayer';
  opacity: number;              // 整体透明度 0-1
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light';
  density: 'low' | 'medium' | 'high' | 'ultra';
  spacing: {
    x: number;                  // 水印间距X
    y: number;                  // 水印间距Y
  };
  positioning: 'grid' | 'diagonal' | 'random' | 'corners';
  layerCount: number;           // 图层数量
  preserveOriginal: boolean;    // 是否完全保持原始PDF
}

export interface OverlayResult {
  success: boolean;
  processedPDF?: {
    blob: Blob;
    dataUrl: string;
    pageCount: number;
    fileSize: number;
  };
  overlayDetails: {
    watermarkCount: number;
    layersApplied: number;
    mode: string;
    preservedOriginal: boolean;
  };
  processingTime: number;
  warnings?: string[];
  errors?: string[];
}

export class PDFLayerWatermarkOverlay {
  private static readonly DEFAULT_OPTIONS: WatermarkOverlayOptions = {
    mode: 'foreground',
    opacity: 0.3,
    blendMode: 'normal',
    density: 'medium',
    spacing: { x: 200, y: 150 },
    positioning: 'grid',
    layerCount: 1,
    preserveOriginal: true
  };

  /**
   * 主叠加方法 - 在PDF上叠加水印图层
   */
  static async overlayWatermarkOnPDF(
    pdfBlob: Blob,
    watermarkSettings: WatermarkSettings,
    options: Partial<WatermarkOverlayOptions> = {}
  ): Promise<OverlayResult> {
    const startTime = performance.now();
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const warnings: string[] = [];
    const errors: string[] = [];

    console.log('🎨 开始PDF水印图层叠加:', {
      pdfSize: pdfBlob.size,
      config,
      timestamp: new Date().toISOString()
    });

    try {
      // 1. 加载PDF-lib库
      const PDFLib = await LibraryLoader.loadLibrary('pdf-lib').then(() => window.PDFLib);
      
      if (!PDFLib) {
        throw new Error('PDF-lib库未加载');
      }

      // 2. 加载现有PDF文档
      console.log('📄 加载现有PDF文档...');
      const existingPdfBytes = await pdfBlob.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      
      console.log(`📊 PDF加载完成: ${pages.length}页`);

      // 3. 创建水印图像
      console.log('🎨 创建水印图像...');
      const watermarkImages = await this.createWatermarkLayers(watermarkSettings, config);
      
      if (watermarkImages.length === 0) {
        throw new Error('水印图像创建失败');
      }

      console.log(`✅ 创建了${watermarkImages.length}个水印图像`);

      // 4. 为每个页面叠加水印
      let totalWatermarkCount = 0;
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        
        console.log(`🖼️ 为页面${pageIndex + 1}叠加水印 (${width}x${height})`);
        
        const pageWatermarkCount = await this.overlayWatermarkOnPage(
          page, 
          pdfDoc, 
          watermarkImages, 
          { width, height }, 
          config
        );
        
        totalWatermarkCount += pageWatermarkCount;
        
        console.log(`✅ 页面${pageIndex + 1}完成，添加了${pageWatermarkCount}个水印`);
      }

      // 5. 生成最终PDF
      console.log('💾 生成最终PDF...');
      const finalPdfBytes = await pdfDoc.save({
        useObjectStreams: false,  // 确保兼容性
        addDefaultPage: false     // 不添加默认页面
      });
      
      const finalBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const finalDataUrl = URL.createObjectURL(finalBlob);

      const processingTime = performance.now() - startTime;

      console.log('✅ PDF水印叠加完成:', {
        originalSize: pdfBlob.size,
        finalSize: finalBlob.size,
        pageCount: pages.length,
        totalWatermarks: totalWatermarkCount,
        processingTime
      });

      return {
        success: true,
        processedPDF: {
          blob: finalBlob,
          dataUrl: finalDataUrl,
          pageCount: pages.length,
          fileSize: finalBlob.size
        },
        overlayDetails: {
          watermarkCount: totalWatermarkCount,
          layersApplied: watermarkImages.length,
          mode: config.mode,
          preservedOriginal: config.preserveOriginal
        },
        processingTime,
        warnings,
        errors
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('❌ PDF水印叠加失败:', error);
      
      return {
        success: false,
        overlayDetails: {
          watermarkCount: 0,
          layersApplied: 0,
          mode: config.mode,
          preservedOriginal: false
        },
        processingTime,
        errors: [error instanceof Error ? error.message : '未知错误']
      };
    }
  }

  /**
   * 创建水印图层
   */
  private static async createWatermarkLayers(
    settings: WatermarkSettings,
    options: WatermarkOverlayOptions
  ): Promise<Array<{
    imageData: string;
    width: number;
    height: number;
    layerIndex: number;
    opacity: number;
  }>> {
    const watermarkLayers = [];

    try {
      // 转换为中文水印选项
      const watermarkOptions = ChineseWatermarkRenderer.convertFromWatermarkSettings(settings);
      
      // 根据密度调整水印大小
      const sizeMultiplier = this.getDensitySizeMultiplier(options.density);
      watermarkOptions.fontSize = Math.floor(watermarkOptions.fontSize * sizeMultiplier);

      // 创建多个图层
      for (let layerIndex = 0; layerIndex < options.layerCount; layerIndex++) {
        // 为不同图层调整透明度和样式
        const layerOptions = {
          ...watermarkOptions,
          opacity: watermarkOptions.opacity * (1 - layerIndex * 0.1), // 每层递减透明度
          rotation: watermarkOptions.rotation + layerIndex * 5 // 每层稍微旋转
        };

        console.log(`🎨 创建第${layerIndex + 1}层水印...`);
        
        // 创建水印图像
        const watermarkImage = await ChineseWatermarkRenderer.createChineseWatermarkImage(layerOptions);
        
        watermarkLayers.push({
          imageData: watermarkImage.dataUrl,
          width: watermarkImage.dimensions.width,
          height: watermarkImage.dimensions.height,
          layerIndex,
          opacity: options.opacity * (1 - layerIndex * 0.1)
        });

        console.log(`✅ 第${layerIndex + 1}层水印创建完成 (${watermarkImage.dimensions.width}x${watermarkImage.dimensions.height})`);
      }

    } catch (error) {
      console.error('创建水印图层失败:', error);
    }

    return watermarkLayers;
  }

  /**
   * 在单个页面上叠加水印
   */
  private static async overlayWatermarkOnPage(
    page: any,
    pdfDoc: any,
    watermarkImages: any[],
    pageSize: { width: number; height: number },
    options: WatermarkOverlayOptions
  ): Promise<number> {
    let watermarkCount = 0;

    try {
      // 计算水印位置
      const positions = this.calculateWatermarkPositions(pageSize, options);
      
      console.log(`📍 计算得到${positions.length}个水印位置`);

      // 为每个位置和每个图层添加水印
      for (const position of positions) {
        for (const watermarkLayer of watermarkImages) {
          try {
            // 将Base64图像转换为PDF可用格式
            const imageBytes = this.base64ToArrayBuffer(watermarkLayer.imageData);
            const pdfImage = await pdfDoc.embedPng(imageBytes);

            // 计算实际绘制尺寸
            const scale = this.calculateWatermarkScale(
              { width: watermarkLayer.width, height: watermarkLayer.height },
              pageSize,
              options.density
            );

            const drawWidth = watermarkLayer.width * scale;
            const drawHeight = watermarkLayer.height * scale;

            // 根据叠加模式确定绘制参数
            const drawParams = this.getDrawParameters(
              position,
              { width: drawWidth, height: drawHeight },
              pageSize,
              options,
              watermarkLayer
            );

            // 绘制水印
            page.drawImage(pdfImage, drawParams);
            
            watermarkCount++;

          } catch (imageError) {
            console.warn(`水印绘制失败 (位置${position.x},${position.y}, 图层${watermarkLayer.layerIndex}):`, imageError);
          }
        }
      }

    } catch (error) {
      console.error('页面水印叠加失败:', error);
    }

    return watermarkCount;
  }

  /**
   * 计算水印位置
   */
  private static calculateWatermarkPositions(
    pageSize: { width: number; height: number },
    options: WatermarkOverlayOptions
  ): Array<{ x: number; y: number; rotation?: number }> {
    const positions = [];
    const { width, height } = pageSize;
    const { spacing, positioning } = options;

    switch (positioning) {
      case 'grid':
        // 网格布局
        for (let x = spacing.x / 2; x < width; x += spacing.x) {
          for (let y = spacing.y / 2; y < height; y += spacing.y) {
            positions.push({ x, y });
          }
        }
        break;

      case 'diagonal':
        // 对角线布局
        const diagonal = Math.sqrt(width * width + height * height);
        const steps = Math.floor(diagonal / Math.min(spacing.x, spacing.y));
        const stepX = width / steps;
        const stepY = height / steps;
        
        for (let i = 0; i < steps; i++) {
          positions.push({ 
            x: i * stepX, 
            y: i * stepY,
            rotation: -45 // 对角线旋转
          });
        }
        break;

      case 'random':
        // 随机布局
        const randomCount = Math.floor((width * height) / (spacing.x * spacing.y));
        for (let i = 0; i < randomCount; i++) {
          positions.push({
            x: Math.random() * width,
            y: Math.random() * height,
            rotation: Math.random() * 360
          });
        }
        break;

      case 'corners':
        // 四角布局
        const margin = 50;
        positions.push(
          { x: margin, y: height - margin },           // 左上
          { x: width - margin, y: height - margin },   // 右上
          { x: margin, y: margin },                    // 左下
          { x: width - margin, y: margin }             // 右下
        );
        break;

      default:
        // 默认中心位置
        positions.push({ 
          x: width / 2, 
          y: height / 2 
        });
        break;
    }

    return positions;
  }

  /**
   * 计算水印缩放比例
   */
  private static calculateWatermarkScale(
    watermarkSize: { width: number; height: number },
    pageSize: { width: number; height: number },
    density: string
  ): number {
    const pageArea = pageSize.width * pageSize.height;
    const watermarkArea = watermarkSize.width * watermarkSize.height;
    
    // 根据密度调整基础比例
    const densityScale = {
      low: 0.8,
      medium: 0.6,
      high: 0.4,
      ultra: 0.3
    }[density] || 0.6;

    // 确保水印不会太大
    const maxScale = Math.min(
      (pageSize.width * 0.3) / watermarkSize.width,
      (pageSize.height * 0.3) / watermarkSize.height
    );

    return Math.min(densityScale, maxScale);
  }

  /**
   * 获取绘制参数
   */
  private static getDrawParameters(
    position: { x: number; y: number; rotation?: number },
    watermarkSize: { width: number; height: number },
    pageSize: { width: number; height: number },
    options: WatermarkOverlayOptions,
    watermarkLayer: any
  ): any {
    const drawParams: any = {
      x: position.x - watermarkSize.width / 2,
      y: position.y - watermarkSize.height / 2,
      width: watermarkSize.width,
      height: watermarkSize.height,
      opacity: watermarkLayer.opacity
    };

    // 添加旋转
    if (position.rotation !== undefined) {
      drawParams.rotate = {
        angle: position.rotation,
        xPos: position.x,
        yPos: position.y
      };
    }

    // 根据模式调整参数
    switch (options.mode) {
      case 'background':
        // 背景模式：降低透明度，使用柔和混合
        drawParams.opacity *= 0.5;
        break;

      case 'foreground':
        // 前景模式：正常透明度
        break;

      case 'mixed':
        // 混合模式：中等透明度
        drawParams.opacity *= 0.7;
        break;

      case 'multilayer':
        // 多层模式：每层不同透明度
        drawParams.opacity *= (1 - watermarkLayer.layerIndex * 0.1);
        break;
    }

    return drawParams;
  }

  /**
   * Base64转ArrayBuffer
   */
  private static base64ToArrayBuffer(base64Data: string): ArrayBuffer {
    // 移除data:image/png;base64,前缀
    const base64 = base64Data.split(',')[1] || base64Data;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * 根据密度获取尺寸倍数
   */
  private static getDensitySizeMultiplier(density: string): number {
    const multipliers = {
      low: 1.2,
      medium: 1.0,
      high: 0.8,
      ultra: 0.6
    };
    
    return multipliers[density as keyof typeof multipliers] || 1.0;
  }

  /**
   * 获取支持的叠加模式
   */
  static getSupportedOverlayModes(): Array<{
    mode: string;
    description: string;
    opacity: number;
    suitable: string[];
  }> {
    return [
      {
        mode: 'background',
        description: '背景层叠加 - 水印在内容下方，不影响阅读',
        opacity: 0.15,
        suitable: ['重要文档', '合同文件', '版权保护']
      },
      {
        mode: 'foreground',
        description: '前景层叠加 - 水印在内容上方，醒目显示',
        opacity: 0.3,
        suitable: ['宣传材料', '样本文档', '防盗版']
      },
      {
        mode: 'mixed',
        description: '混合层叠加 - 水印与内容混合，平衡效果',
        opacity: 0.2,
        suitable: ['一般文档', '报告文件', '日常使用']
      },
      {
        mode: 'multilayer',
        description: '多层叠加 - 多个水印层组合，最强保护',
        opacity: 0.25,
        suitable: ['机密文档', '高价值内容', '强版权保护']
      }
    ];
  }

  /**
   * 预估处理时间
   */
  static estimateProcessingTime(
    pdfSizeKB: number,
    pageCount: number,
    watermarkCount: number
  ): number {
    // 基础处理时间（毫秒）
    const baseTime = 500;
    
    // 每KB文件大小增加的时间
    const timePerKB = 2;
    
    // 每页增加的时间
    const timePerPage = 100;
    
    // 每个水印增加的时间
    const timePerWatermark = 50;
    
    const estimatedTime = baseTime + 
                         (pdfSizeKB * timePerKB) + 
                         (pageCount * timePerPage) + 
                         (watermarkCount * timePerWatermark);
    
    return Math.max(estimatedTime, 1000); // 至少1秒
  }
}