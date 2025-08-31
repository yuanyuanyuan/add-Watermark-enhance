/**
 * PDF水印合并引擎 - 方案A核心组件
 * 专门负责将独立生成的水印图片与PDF文档合并
 * 
 * 核心特性：
 * 1. PDF + 水印图片专业合并（您的建议）
 * 2. 多层水印叠加策略
 * 3. 批量页面处理优化
 * 4. 质量控制和压缩
 */

import { LibraryLoader } from '../../utils/cdn/LibraryLoader';
import type { GeneratedWatermark } from '../watermark/WatermarkImageGenerator';

export interface MergeOptions {
  strategy: 'overlay' | 'background' | 'mixed' | 'alternating';
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
  globalOpacity: number; // 0-1, 额外的全局透明度控制
  quality: 'draft' | 'balanced' | 'high' | 'maximum';
  compression: boolean;
  preserveMetadata: boolean;
  batchSize: number; // 批量处理页面数
}

export interface WatermarkPlacement {
  watermark: GeneratedWatermark;
  position: { x: number; y: number };
  scale?: number; // 缩放比例
  rotation?: number; // 额外旋转角度
  opacity?: number; // 页面级透明度覆盖
  layer?: number; // 图层顺序
  pageNumbers?: number[]; // 指定页面，不填则应用到所有页面
}

export interface MergeResult {
  success: boolean;
  processedDocument?: {
    blob: Blob;
    dataUrl: string;
    format: string;
    pageCount: number;
    size: number;
  };
  statistics: {
    originalSize: number;
    finalSize: number;
    compressionRatio: number;
    watermarkCount: number;
    processingTime: number;
    pagesProcessed: number;
  };
  warnings?: string[];
  errors?: string[];
}

export class PDFWatermarkMerger {
  private static readonly DEFAULT_OPTIONS: MergeOptions = {
    strategy: 'overlay',
    blendMode: 'normal',
    globalOpacity: 1.0,
    quality: 'balanced',
    compression: true,
    preserveMetadata: true,
    batchSize: 5
  };

  private static readonly QUALITY_SETTINGS = {
    draft: { imageQuality: 0.3, compression: true, downscale: 0.7 },
    balanced: { imageQuality: 0.7, compression: true, downscale: 1.0 },
    high: { imageQuality: 0.9, compression: false, downscale: 1.0 },
    maximum: { imageQuality: 1.0, compression: false, downscale: 1.2 }
  };

  /**
   * 主合并入口 - 方案A核心功能实现
   */
  static async mergePDFWithWatermarks(
    pdfDocument: {
      blob: Blob;
      dataUrl?: string;
      pageCount?: number;
    },
    watermarkPlacements: WatermarkPlacement[],
    options: Partial<MergeOptions> = {}
  ): Promise<MergeResult> {
    const startTime = performance.now();
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const warnings: string[] = [];
    const errors: string[] = [];

    console.log('🔗 开始PDF与水印图片合并:', {
      originalSize: pdfDocument.blob.size,
      watermarkCount: watermarkPlacements.length,
      config
    });

    try {
      // 1. 加载PDF-lib库
      const PDFLib = await LibraryLoader.loadLibraries(['pdf-lib', 'fontkit'])
        .then(() => window.PDFLib);
      
      if (!PDFLib) {
        throw new Error('PDF-lib库加载失败');
      }

      // 2. 加载原始PDF
      const originalPdfBytes = await pdfDocument.blob.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
      
      // 注册Fontkit以支持自定义字体
      pdfDoc.registerFontkit(window.fontkit);

      const pages = pdfDoc.getPages();
      console.log(`📄 加载PDF成功，共${pages.length}页`);

      // 3. 预处理水印图片
      const processedWatermarks = await this.preprocessWatermarks(
        watermarkPlacements,
        PDFLib,
        pdfDoc
      );

      // 4. 批量处理页面
      const batchResults = await this.processPagesInBatches(
        pages,
        processedWatermarks,
        config
      );

      // 5. 应用质量设置和压缩
      const finalPdfBytes = await this.finalizePDF(pdfDoc, config);

      // 6. 生成结果
      const finalBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const dataUrl = URL.createObjectURL(finalBlob);

      const processingTime = performance.now() - startTime;
      const statistics = {
        originalSize: pdfDocument.blob.size,
        finalSize: finalBlob.size,
        compressionRatio: finalBlob.size / pdfDocument.blob.size,
        watermarkCount: watermarkPlacements.length,
        processingTime,
        pagesProcessed: pages.length
      };

      console.log('✅ PDF水印合并完成:', statistics);

      return {
        success: true,
        processedDocument: {
          blob: finalBlob,
          dataUrl,
          format: 'pdf',
          pageCount: pages.length,
          size: finalBlob.size
        },
        statistics,
        warnings,
        errors
      };

    } catch (error) {
      console.error('❌ PDF水印合并失败:', error);
      const processingTime = performance.now() - startTime;
      
      return {
        success: false,
        statistics: {
          originalSize: pdfDocument.blob.size,
          finalSize: 0,
          compressionRatio: 0,
          watermarkCount: watermarkPlacements.length,
          processingTime,
          pagesProcessed: 0
        },
        errors: [error instanceof Error ? error.message : '未知合并错误']
      };
    }
  }

  /**
   * 预处理水印图片 - 转换为PDF可嵌入格式
   */
  private static async preprocessWatermarks(
    placements: WatermarkPlacement[],
    PDFLib: any,
    pdfDoc: any
  ): Promise<Array<{
    placement: WatermarkPlacement;
    embeddedImage: any;
    metadata: {
      width: number;
      height: number;
      format: string;
    };
  }>> {
    console.log('🔄 预处理水印图片...');

    const processed = [];
    
    for (const placement of placements) {
      try {
        const watermark = placement.watermark;
        
        // 转换Blob为ArrayBuffer
        const imageBytes = await watermark.blob.arrayBuffer();
        
        // 根据格式嵌入图片
        let embeddedImage;
        if (watermark.format === 'png' || watermark.format === 'webp') {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else if (watermark.format === 'jpg' || watermark.format === 'jpeg') {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else if (watermark.format === 'svg') {
          // SVG需要特殊处理，先转换为PNG
          const pngBytes = await this.convertSVGToPNG(watermark.blob);
          embeddedImage = await pdfDoc.embedPng(pngBytes);
        } else {
          throw new Error(`不支持的水印图片格式: ${watermark.format}`);
        }

        processed.push({
          placement,
          embeddedImage,
          metadata: {
            width: watermark.dimensions.width,
            height: watermark.dimensions.height,
            format: watermark.format
          }
        });

        console.log(`✅ 水印图片预处理完成: ${watermark.format} ${watermark.dimensions.width}x${watermark.dimensions.height}`);

      } catch (error) {
        console.warn('⚠️ 水印图片预处理失败:', error);
        // 继续处理其他水印，不中断整个流程
      }
    }

    console.log(`📊 水印预处理完成: ${processed.length}/${placements.length} 成功`);
    return processed;
  }

  /**
   * 批量处理页面 - 优化大文档处理性能
   */
  private static async processPagesInBatches(
    pages: any[],
    processedWatermarks: Array<{
      placement: WatermarkPlacement;
      embeddedImage: any;
      metadata: any;
    }>,
    config: MergeOptions
  ): Promise<void> {
    console.log(`🔄 开始批量处理${pages.length}页，批量大小: ${config.batchSize}`);

    for (let i = 0; i < pages.length; i += config.batchSize) {
      const batch = pages.slice(i, i + config.batchSize);
      const batchNumber = Math.floor(i / config.batchSize) + 1;
      const totalBatches = Math.ceil(pages.length / config.batchSize);

      console.log(`📄 处理批次 ${batchNumber}/${totalBatches} (页面 ${i + 1}-${Math.min(i + config.batchSize, pages.length)})`);

      // 并行处理批次中的页面
      await Promise.all(batch.map((page, batchIndex) => {
        const pageNumber = i + batchIndex + 1;
        return this.processPageWithWatermarksAsync(page, pageNumber, processedWatermarks, config);
      }));

      console.log(`✅ 批次 ${batchNumber} 处理完成`);
    }
  }

  /**
   * 异步处理单个页面 - 添加水印
   */
  private static async processPageWithWatermarksAsync(
    page: any,
    pageNumber: number,
    processedWatermarks: Array<{
      placement: WatermarkPlacement;
      embeddedImage: any;
      metadata: any;
    }>,
    config: MergeOptions
  ): Promise<void> {
    try {
      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      // 根据策略排序水印图层
      const sortedWatermarks = this.sortWatermarksByStrategy(processedWatermarks, config.strategy, pageNumber);

      for (const { placement, embeddedImage, metadata } of sortedWatermarks) {
        // 检查是否应该应用到当前页面
        if (placement.pageNumbers && !placement.pageNumbers.includes(pageNumber)) {
          continue;
        }

        // 计算最终位置和尺寸
        const finalPlacement = this.calculateFinalPlacement(
          placement,
          metadata,
          pageWidth,
          pageHeight,
          config
        );

        // 绘制水印
        page.drawImage(embeddedImage, {
          x: finalPlacement.x,
          y: pageHeight - finalPlacement.y - finalPlacement.height, // PDF坐标系转换
          width: finalPlacement.width,
          height: finalPlacement.height,
          opacity: finalPlacement.opacity,
          rotate: {
            type: 'degrees',
            angle: finalPlacement.rotation || 0
          }
        });
      }

    } catch (error) {
      console.warn(`⚠️ 页面${pageNumber}水印处理失败:`, error);
    }
  }

  /**
   * 根据策略排序水印图层
   */
  private static sortWatermarksByStrategy(
    watermarks: any[],
    strategy: string,
    pageNumber: number
  ): any[] {
    switch (strategy) {
      case 'background':
        // 背景水印：按层级升序，先绘制底层
        return watermarks.sort((a, b) => (a.placement.layer || 0) - (b.placement.layer || 0));
      
      case 'overlay':
        // 覆盖水印：按层级降序，后绘制顶层
        return watermarks.sort((a, b) => (b.placement.layer || 0) - (a.placement.layer || 0));
      
      case 'alternating':
        // 交替模式：奇偶页不同策略
        if (pageNumber % 2 === 1) {
          return watermarks.sort((a, b) => (a.placement.layer || 0) - (b.placement.layer || 0));
        } else {
          return watermarks.sort((a, b) => (b.placement.layer || 0) - (a.placement.layer || 0));
        }
      
      case 'mixed':
      default:
        // 混合模式：保持原始顺序，但按层级分组
        return watermarks.sort((a, b) => {
          const layerA = a.placement.layer || 0;
          const layerB = b.placement.layer || 0;
          if (layerA !== layerB) return layerA - layerB;
          return 0; // 同层级保持原始顺序
        });
    }
  }

  /**
   * 计算最终放置参数
   */
  private static calculateFinalPlacement(
    placement: WatermarkPlacement,
    metadata: any,
    pageWidth: number,
    pageHeight: number,
    config: MergeOptions
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    rotation?: number;
  } {
    // 基础位置
    let x = placement.position.x;
    let y = placement.position.y;
    
    // 应用缩放
    const scale = placement.scale || 1.0;
    const qualitySettings = this.QUALITY_SETTINGS[config.quality];
    const finalScale = scale * qualitySettings.downscale;
    
    const width = metadata.width * finalScale;
    const height = metadata.height * finalScale;
    
    // 边界检查和调整
    if (x + width > pageWidth) {
      x = pageWidth - width - 10; // 10px边距
    }
    if (y + height > pageHeight) {
      y = pageHeight - height - 10;
    }
    
    // 确保不超出页面边界
    x = Math.max(0, x);
    y = Math.max(0, y);
    
    // 计算最终透明度
    const baseOpacity = placement.opacity || placement.watermark.quality === 'draft' ? 0.3 : 0.5;
    const globalOpacity = config.globalOpacity;
    const finalOpacity = Math.min(1.0, baseOpacity * globalOpacity);
    
    return {
      x,
      y,
      width,
      height,
      opacity: finalOpacity,
      rotation: placement.rotation
    };
  }

  /**
   * 完成PDF处理 - 应用质量设置和压缩
   */
  private static async finalizePDF(pdfDoc: any, config: MergeOptions): Promise<Uint8Array> {
    console.log('🔧 应用最终PDF设置...');
    
    const qualitySettings = this.QUALITY_SETTINGS[config.quality];
    
    // 设置PDF保存选项
    const saveOptions: any = {
      useObjectStreams: config.compression,
      addDefaultPage: false
    };
    
    // 如果启用压缩，添加压缩选项
    if (config.compression) {
      saveOptions.compress = true;
    }
    
    // 保存PDF
    const pdfBytes = await pdfDoc.save(saveOptions);
    
    console.log('✅ PDF最终化完成');
    return pdfBytes;
  }

  /**
   * SVG转PNG工具方法
   */
  private static async convertSVGToPNG(svgBlob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            pngBlob.arrayBuffer().then(resolve);
          } else {
            reject(new Error('SVG转PNG失败'));
          }
        }, 'image/png');
        
        URL.revokeObjectURL(url);
      };
      
      img.onerror = () => {
        reject(new Error('SVG图片加载失败'));
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    });
  }

  /**
   * 快速合并模式 - 适用于简单场景
   */
  static async quickMergePDFWithWatermarks(
    pdfBlob: Blob,
    watermarkImages: Array<GeneratedWatermark & { position: { x: number; y: number } }>,
    opacity: number = 0.5
  ): Promise<Blob> {
    const placements: WatermarkPlacement[] = watermarkImages.map(wm => ({
      watermark: wm,
      position: wm.position,
      opacity
    }));

    const result = await this.mergePDFWithWatermarks(
      { blob: pdfBlob },
      placements,
      { strategy: 'overlay', quality: 'balanced' }
    );

    if (!result.success || !result.processedDocument) {
      throw new Error(result.errors?.[0] || 'PDF合并失败');
    }

    return result.processedDocument.blob;
  }

  /**
   * 获取合并统计信息
   */
  static async analyzePDFForMerge(pdfBlob: Blob): Promise<{
    pageCount: number;
    pageSize: { width: number; height: number };
    fileSize: number;
    estimated: {
      maxWatermarks: number;
      processingTime: number; // 估算毫秒
    };
  }> {
    try {
      const PDFLib = await LibraryLoader.loadLibrary('pdf-lib').then(() => window.PDFLib);
      const pdfBytes = await pdfBlob.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage ? firstPage.getSize() : { width: 595, height: 842 };
      
      // 估算处理能力
      const maxWatermarks = Math.floor((width * height) / (200 * 150)); // 基于200x150间距
      const processingTime = pages.length * 100 + maxWatermarks * 50; // 估算公式
      
      return {
        pageCount: pages.length,
        pageSize: { width, height },
        fileSize: pdfBlob.size,
        estimated: {
          maxWatermarks,
          processingTime
        }
      };
    } catch (error) {
      throw new Error(`PDF分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}