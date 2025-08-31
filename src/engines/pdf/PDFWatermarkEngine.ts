/**
 * PDF水印引擎 - 网格状水印覆盖架构
 * 基于用户提供的技术方案：统一PDF输出架构 + 网格状水印覆盖
 * 支持多种水印模式：单点、网格、边界、自适应分布
 * 新增：CDN动态加载 + 增强中文渲染 + 多层网格水印
 */

import { ChineseWatermarkRenderer, type ChineseWatermarkOptions } from '../canvas/ChineseWatermarkRenderer';
import { LibraryLoader } from '../../utils/cdn/LibraryLoader';
// import { FileFormatDetector } from '../../utils/document/FileFormatDetector'; // 暂未使用
import type { WatermarkSettings } from '../../types/watermark.types';

// PDF-lib 类型定义（动态加载时使用）
interface PDFDocument {
  getPages(): PDFPage[];
  getPageCount(): number;
  addPage(size?: [number, number]): PDFPage;
  embedPng(pngImageBytes: Uint8Array): Promise<PDFImage>;
  registerFontkit?: (fontkit: any) => void;
  save(): Promise<Uint8Array>;
}

interface PDFPage {
  getSize(): { width: number; height: number };
  drawText(text: string, options?: any): void;
  drawImage(image: PDFImage, options?: any): void;
}

interface PDFImage {
  scale(factor: number): { width: number; height: number };
}

// RGB 颜色函数类型
declare function rgb(r: number, g: number, b: number): any;

export interface PDFWatermarkConfig {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  mode: 'single' | 'grid' | 'boundary' | 'adaptive';
  position?: {
    x?: number | 'left' | 'center' | 'right';
    y?: number | 'top' | 'middle' | 'bottom';
  };
  grid?: {
    spacingX: number;
    spacingY: number;
    offsetX?: number;
    offsetY?: number;
    stagger?: boolean;
  };
  boundary?: {
    margin: number;
    corners: boolean;
    edges: boolean;
    center: boolean;
  };
  adaptive?: {
    density: 'low' | 'medium' | 'high';
    minSpacing: number;
    maxCount: number;
  };
}

export interface WatermarkResult {
  success: boolean;
  pdfDocument: PDFDocument;
  watermarkCount: number;
  pageCount: number;
  processingTime: number;
  statistics: {
    totalWatermarks: number;
    watermarksPerPage: number[];
    coveragePercentage: number;
    memoryUsed: number;
  };
  errors?: string[];
  warnings?: string[];
}

export class PDFWatermarkEngine {
  private static pdfLib: any = null;
  private static fontkit: any = null;
  private static isInitialized = false;

  private static readonly DEFAULT_CONFIG: Partial<PDFWatermarkConfig> = {
    fontSize: 24,
    color: '#000000',
    opacity: 0.3,
    rotation: -45,
    mode: 'grid',
    grid: {
      spacingX: 200,
      spacingY: 150,
      offsetX: 0,
      offsetY: 0,
      stagger: true
    }
  };

  /**
   * 初始化PDF引擎 - 动态加载CDN库
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized && this.pdfLib) {
      console.log('✅ PDF引擎已初始化，跳过重复初始化');
      return;
    }

    console.log('🔧 开始初始化PDF水印引擎 - CDN动态加载...');
    
    try {
      // 动态加载PDF-lib库
      await LibraryLoader.loadLibrary('pdf-lib');
      this.pdfLib = (window as any).PDFLib;
      
      if (!this.pdfLib) {
        throw new Error('PDF-lib库加载失败');
      }

      // 动态加载Fontkit库（用于字体支持）
      try {
        await LibraryLoader.loadLibrary('fontkit');
        this.fontkit = (window as any).fontkit;
        console.log('✅ Fontkit字体库加载成功');
      } catch (fontError) {
        console.warn('⚠️ Fontkit加载失败，将使用基础字体:', fontError);
        // fontkit是可选的，不影响基础功能
      }

      this.isInitialized = true;

      console.log('✅ PDF水印引擎初始化完成', {
        pdfLibAvailable: !!this.pdfLib,
        fontkitAvailable: !!this.fontkit,
        supportedFeatures: [
          'PDF文档创建',
          '中文水印渲染',
          '网格水印布局',
          'PNG水印嵌入',
          this.fontkit ? '高级字体支持' : '基础字体支持'
        ].filter(Boolean)
      });

    } catch (error) {
      this.isInitialized = false;
      console.error('❌ PDF引擎初始化失败:', error);
      throw new Error(`PDF引擎初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 为PDF文档添加网格状水印覆盖 - 支持CDN动态加载
   */
  static async addGridWatermarkToPDF(
    pdfDocOrBuffer: any, // 可以是PDFDocument或ArrayBuffer
    config: PDFWatermarkConfig
  ): Promise<WatermarkResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalWatermarks = 0;
    const watermarksPerPage: number[] = [];

    // 确保PDF引擎已初始化
    if (!this.isInitialized) {
      await this.initialize();
    }

    let pdfDoc: any;
    
    try {
      // 处理输入参数，支持多种类型
      if (pdfDocOrBuffer.constructor.name === 'PDFDocument' || pdfDocOrBuffer.getPages) {
        // 已经是PDFDocument实例
        pdfDoc = pdfDocOrBuffer;
      } else if (pdfDocOrBuffer instanceof ArrayBuffer || pdfDocOrBuffer instanceof Uint8Array) {
        // 从ArrayBuffer加载PDF
        pdfDoc = await this.pdfLib.PDFDocument.load(pdfDocOrBuffer);
      } else {
        // 创建新的PDF文档
        pdfDoc = await this.pdfLib.PDFDocument.create();
      }

      // 注册字体支持
      if (this.fontkit && pdfDoc.registerFontkit) {
        pdfDoc.registerFontkit(this.fontkit);
        console.log('🔤 高级字体支持已启用');
      }

      console.log('🔷 开始PDF网格水印处理:', {
        mode: config.mode,
        pageCount: pdfDoc.getPageCount(),
        engineInitialized: this.isInitialized,
        config: {
          text: config.text,
          fontSize: config.fontSize,
          opacity: config.opacity,
          grid: config.grid
        },
        containsChinese: ChineseWatermarkRenderer.containsChineseCharacters(config.text)
      });

      const pages = pdfDoc.getPages();
      
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const pageWatermarkCount = await this.addWatermarksToPage(
          pdfDoc, 
          page, 
          config, 
          pageIndex + 1
        );
        
        totalWatermarks += pageWatermarkCount;
        watermarksPerPage.push(pageWatermarkCount);

        console.log(`✅ 页面 ${pageIndex + 1} 水印添加完成: ${pageWatermarkCount} 个水印`);
      }

      // 计算覆盖率统计
      const coveragePercentage = this.calculateCoveragePercentage(pages, config);
      const memoryEstimate = this.estimateMemoryUsage(totalWatermarks, config);

      const processingTime = performance.now() - startTime;

      console.log('🎯 PDF水印处理完成统计:', {
        totalPages: pages.length,
        totalWatermarks,
        averageWatermarksPerPage: Math.round(totalWatermarks / pages.length),
        coveragePercentage: `${coveragePercentage.toFixed(1)}%`,
        processingTime: `${processingTime.toFixed(1)}ms`,
        memoryEstimate: `${memoryEstimate.toFixed(1)}KB`
      });

      return {
        success: true,
        pdfDocument: pdfDoc,
        watermarkCount: totalWatermarks,
        pageCount: pages.length,
        processingTime,
        statistics: {
          totalWatermarks,
          watermarksPerPage,
          coveragePercentage,
          memoryUsed: memoryEstimate
        },
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      console.error('❌ PDF水印处理失败:', error);
      
      return {
        success: false,
        pdfDocument: pdfDoc,
        watermarkCount: 0,
        pageCount: pdfDoc.getPageCount(),
        processingTime: performance.now() - startTime,
        statistics: {
          totalWatermarks: 0,
          watermarksPerPage: [],
          coveragePercentage: 0,
          memoryUsed: 0
        },
        errors: [error instanceof Error ? error.message : '未知错误']
      };
    }
  }

  /**
   * 为单个页面添加水印
   */
  private static async addWatermarksToPage(
    pdfDoc: PDFDocument,
    page: PDFPage,
    config: PDFWatermarkConfig,
    pageNumber: number
  ): Promise<number> {
    const { width, height } = page.getSize();
    let watermarkCount = 0;

    console.log(`🔷 处理页面 ${pageNumber}:`, {
      size: { width, height },
      mode: config.mode
    });

    switch (config.mode) {
      case 'single':
        watermarkCount = await this.addSingleWatermark(pdfDoc, page, config);
        break;
      
      case 'grid':
        watermarkCount = await this.addGridWatermarks(pdfDoc, page, config, width, height);
        break;
      
      case 'boundary':
        watermarkCount = await this.addBoundaryWatermarks(pdfDoc, page, config, width, height);
        break;
      
      case 'adaptive':
        watermarkCount = await this.addAdaptiveWatermarks(pdfDoc, page, config, width, height);
        break;
      
      default:
        console.warn(`未知的水印模式: ${config.mode}，使用网格模式`);
        watermarkCount = await this.addGridWatermarks(pdfDoc, page, config, width, height);
        break;
    }

    return watermarkCount;
  }

  /**
   * 添加单个水印
   */
  private static async addSingleWatermark(
    pdfDoc: PDFDocument,
    page: PDFPage,
    config: PDFWatermarkConfig
  ): Promise<number> {
    const { width, height } = page.getSize();
    
    // 计算位置
    let x = width / 2; // 默认居中
    let y = height / 2;

    if (config.position) {
      if (typeof config.position.x === 'number') {
        x = config.position.x;
      } else if (config.position.x === 'left') {
        x = width * 0.2;
      } else if (config.position.x === 'right') {
        x = width * 0.8;
      }

      if (typeof config.position.y === 'number') {
        y = config.position.y;
      } else if (config.position.y === 'top') {
        y = height * 0.8;
      } else if (config.position.y === 'bottom') {
        y = height * 0.2;
      }
    }

    await this.drawWatermarkAtPosition(pdfDoc, page, config, x, y);
    return 1;
  }

  /**
   * 添加网格状水印 - 增强版支持多层水印和智能布局
   */
  private static async addGridWatermarks(
    pdfDoc: any,
    page: any,
    config: PDFWatermarkConfig,
    pageWidth: number,
    pageHeight: number
  ): Promise<number> {
    const grid = { ...this.DEFAULT_CONFIG.grid, ...config.grid };
    let watermarkCount = 0;

    console.log('🔲 开始增强网格水印处理:', {
      pageSize: { width: pageWidth, height: pageHeight },
      gridSettings: grid,
      textContent: config.text,
      containsChinese: ChineseWatermarkRenderer.containsChineseCharacters(config.text)
    });

    try {
      // 使用增强的ChineseWatermarkRenderer创建网格水印
      const watermarkOptions: ChineseWatermarkOptions = {
        text: config.text,
        fontSize: config.fontSize,
        color: config.color,
        opacity: config.opacity,
        rotation: config.rotation || 0,
        fontFamily: ChineseWatermarkRenderer.detectOptimalChineseFont(config.text)
      };

      // 生成网格水印数据
      const gridResult = await ChineseWatermarkRenderer.createGridWatermarkForPDF(
        watermarkOptions,
        { width: pageWidth, height: pageHeight },
        {
          spacingX: grid.spacingX,
          spacingY: grid.spacingY,
          layers: 1, // 基础模式使用单层
          densityMode: 'normal',
          boundaryMargin: 50
        }
      );

      console.log('🎨 网格水印数据生成完成:', gridResult.stats);

      // 将生成的水印嵌入PDF页面
      for (const watermarkItem of gridResult.watermarkData) {
        try {
          // 将base64 dataURL转换为图像字节
          const imageBytes = this.dataURLToUint8Array(watermarkItem.imageData);
          
          // 嵌入PNG图像
          const pdfImage = await pdfDoc.embedPng(imageBytes);
          
          // 获取图像尺寸并调整
          const imageDims = pdfImage.scale(0.75); // 稍微缩小以适应网格
          
          // 绘制水印
          page.drawImage(pdfImage, {
            x: watermarkItem.position.x - imageDims.width / 2,
            y: watermarkItem.position.y - imageDims.height / 2,
            width: imageDims.width,
            height: imageDims.height,
            opacity: watermarkItem.opacity
          });

          watermarkCount++;

        } catch (imageError) {
          console.warn('⚠️ 单个水印图像嵌入失败，使用文本回退:', imageError);
          
          // 回退到文本水印
          const colorRgb = this.parseColor(config.color);
          page.drawText(config.text, {
            x: watermarkItem.position.x - (config.text.length * config.fontSize * 0.3),
            y: watermarkItem.position.y,
            size: config.fontSize * 0.8,
            color: this.pdfLib.rgb(colorRgb.r, colorRgb.g, colorRgb.b),
            opacity: watermarkItem.opacity,
            rotate: { angle: (config.rotation || 0) * Math.PI / 180 }
          });
          
          watermarkCount++;
        }
      }

      console.log(`🎯 增强网格水印完成: ${watermarkCount} 个水印`, {
        renderTime: `${gridResult.stats.renderTime.toFixed(1)}ms`,
        coverage: `${gridResult.stats.coverage.toFixed(2)}%`,
        layersProcessed: gridResult.stats.layers
      });

      return watermarkCount;

    } catch (error) {
      console.error('❌ 增强网格水印处理失败，回退到基础模式:', error);
      
      // 回退到基础网格算法
      return await this.addBasicGridWatermarks(pdfDoc, page, config, pageWidth, pageHeight);
    }
  }

  /**
   * 基础网格水印处理（作为回退方案）
   */
  private static async addBasicGridWatermarks(
    pdfDoc: any,
    page: any,
    config: PDFWatermarkConfig,
    pageWidth: number,
    pageHeight: number
  ): Promise<number> {
    const grid = { ...this.DEFAULT_CONFIG.grid, ...config.grid };
    const margin = 50;
    let watermarkCount = 0;

    // 计算网格参数
    const cols = Math.floor((pageWidth - 2 * margin) / (grid.spacingX ?? 200)) + 1;
    const rows = Math.floor((pageHeight - 2 * margin) / (grid.spacingY ?? 150)) + 1;

    console.log('🔲 基础网格水印参数:', {
      pageSize: { width: pageWidth, height: pageHeight },
      grid: { cols, rows, spacingX: grid.spacingX, spacingY: grid.spacingY },
      margin,
      estimatedCount: cols * rows
    });

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let x = margin + col * (grid.spacingX ?? 200) + (grid.offsetX || 0);
        let y = margin + row * (grid.spacingY ?? 150) + (grid.offsetY || 0);

        // 交错排列
        if (grid.stagger && row % 2 === 1) {
          x += (grid.spacingX ?? 200) / 2;
        }

        // 确保在页面范围内
        if (x >= margin && x <= pageWidth - margin && 
            y >= margin && y <= pageHeight - margin) {
          
          // 稍微调整每个水印的透明度以创建层次感
          const adjustedConfig = {
            ...config,
            opacity: config.opacity * (0.8 + 0.4 * Math.random()) // 80%-120%的透明度变化
          };

          await this.drawWatermarkAtPosition(pdfDoc, page, adjustedConfig, x, y);
          watermarkCount++;
        }
      }
    }

    console.log(`🎯 基础网格水印完成: ${watermarkCount} 个水印`);
    return watermarkCount;
  }

  /**
   * 添加边界水印
   */
  private static async addBoundaryWatermarks(
    pdfDoc: PDFDocument,
    page: PDFPage,
    config: PDFWatermarkConfig,
    pageWidth: number,
    pageHeight: number
  ): Promise<number> {
    const boundary = config.boundary || { margin: 50, corners: true, edges: true, center: true };
    let watermarkCount = 0;

    // 四个角落
    if (boundary.corners) {
      const cornerPositions = [
        { x: boundary.margin, y: pageHeight - boundary.margin }, // 左上
        { x: pageWidth - boundary.margin, y: pageHeight - boundary.margin }, // 右上
        { x: boundary.margin, y: boundary.margin }, // 左下
        { x: pageWidth - boundary.margin, y: boundary.margin } // 右下
      ];

      for (const pos of cornerPositions) {
        await this.drawWatermarkAtPosition(pdfDoc, page, config, pos.x, pos.y);
        watermarkCount++;
      }
    }

    // 边缘中点
    if (boundary.edges) {
      const edgePositions = [
        { x: pageWidth / 2, y: pageHeight - boundary.margin }, // 上边
        { x: pageWidth / 2, y: boundary.margin }, // 下边
        { x: boundary.margin, y: pageHeight / 2 }, // 左边
        { x: pageWidth - boundary.margin, y: pageHeight / 2 } // 右边
      ];

      for (const pos of edgePositions) {
        await this.drawWatermarkAtPosition(pdfDoc, page, config, pos.x, pos.y);
        watermarkCount++;
      }
    }

    // 中心
    if (boundary.center) {
      await this.drawWatermarkAtPosition(pdfDoc, page, config, pageWidth / 2, pageHeight / 2);
      watermarkCount++;
    }

    return watermarkCount;
  }

  /**
   * 添加自适应水印
   */
  private static async addAdaptiveWatermarks(
    pdfDoc: PDFDocument,
    page: PDFPage,
    config: PDFWatermarkConfig,
    pageWidth: number,
    pageHeight: number
  ): Promise<number> {
    const adaptive = config.adaptive || { density: 'medium', minSpacing: 150, maxCount: 20 };
    
    let spacingX: number, spacingY: number;
    
    // 根据密度计算间距
    switch (adaptive.density) {
      case 'low':
        spacingX = Math.max(adaptive.minSpacing * 2, pageWidth / 4);
        spacingY = Math.max(adaptive.minSpacing * 2, pageHeight / 4);
        break;
      case 'high':
        spacingX = Math.max(adaptive.minSpacing * 0.7, pageWidth / 8);
        spacingY = Math.max(adaptive.minSpacing * 0.7, pageHeight / 8);
        break;
      default: // medium
        spacingX = Math.max(adaptive.minSpacing, pageWidth / 6);
        spacingY = Math.max(adaptive.minSpacing, pageHeight / 6);
        break;
    }

    // 使用网格算法，但应用自适应参数
    const adaptiveGridConfig = {
      ...config,
      grid: {
        spacingX,
        spacingY,
        offsetX: Math.random() * spacingX * 0.3, // 随机偏移
        offsetY: Math.random() * spacingY * 0.3,
        stagger: true
      }
    };

    const watermarkCount = await this.addGridWatermarks(
      pdfDoc, 
      page, 
      adaptiveGridConfig, 
      pageWidth, 
      pageHeight
    );

    // 限制最大数量
    return Math.min(watermarkCount, adaptive.maxCount);
  }

  /**
   * 在指定位置绘制水印
   */
  private static async drawWatermarkAtPosition(
    pdfDoc: PDFDocument,
    page: PDFPage,
    config: PDFWatermarkConfig,
    x: number,
    y: number
  ): Promise<void> {
    try {
      // 使用Canvas渲染中文水印
      const watermarkOptions: ChineseWatermarkOptions = {
        text: config.text,
        fontSize: config.fontSize,
        color: config.color,
        opacity: config.opacity,
        rotation: config.rotation || 0
      };

      const watermarkImage = await ChineseWatermarkRenderer.createChineseWatermarkImage(watermarkOptions);
      
      // 将水印PNG嵌入PDF
      const imageBytes = await this.blobToArrayBuffer(watermarkImage.blob);
      const pdfImage = await pdfDoc.embedPng(new Uint8Array(imageBytes));

      // 计算绘制参数
      const imageWidth = watermarkImage.dimensions.width * 0.5; // 缩小一点以适应网格
      const imageHeight = watermarkImage.dimensions.height * 0.5;
      
      // 绘制水印（以指定位置为中心）
      page.drawImage(pdfImage, {
        x: x - imageWidth / 2,
        y: y - imageHeight / 2,
        width: imageWidth,
        height: imageHeight,
        opacity: config.opacity * 0.8 // 稍微降低整体透明度
      });

    } catch (error) {
      console.warn('绘制水印失败:', error);
      
      // 回退方案：使用文本水印
      const colorRgb = this.parseColor(config.color);
      page.drawText(config.text, {
        x: x - (config.text.length * config.fontSize * 0.3), // 粗略居中
        y: y,
        size: config.fontSize * 0.8,
        color: this.pdfLib.rgb(colorRgb.r, colorRgb.g, colorRgb.b),
        opacity: config.opacity,
        rotate: { angle: (config.rotation || 0) * Math.PI / 180 }
      });
    }
  }

  /**
   * 计算覆盖率百分比
   */
  private static calculateCoveragePercentage(pages: PDFPage[], config: PDFWatermarkConfig): number {
    if (pages.length === 0) return 0;

    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    const pageArea = width * height;

    // 估算水印覆盖面积
    const watermarkArea = config.fontSize * config.fontSize * 4; // 粗略估算
    const grid = { ...this.DEFAULT_CONFIG.grid, ...config.grid };
    
    let estimatedWatermarks = 0;
    switch (config.mode) {
      case 'single':
        estimatedWatermarks = 1;
        break;
      case 'grid':
        const cols = Math.floor(width / (grid.spacingX ?? 200));
        const rows = Math.floor(height / (grid.spacingY ?? 150));
        estimatedWatermarks = cols * rows;
        break;
      case 'boundary':
        estimatedWatermarks = 9; // 4角 + 4边 + 1中心
        break;
      case 'adaptive':
        estimatedWatermarks = Math.floor(pageArea / ((grid.spacingX ?? 200) * (grid.spacingY ?? 150)));
        break;
      default:
        estimatedWatermarks = Math.floor(pageArea / ((grid.spacingX ?? 200) * (grid.spacingY ?? 150)));
    }

    const totalWatermarkArea = estimatedWatermarks * watermarkArea;
    return Math.min(100, (totalWatermarkArea / pageArea) * 100);
  }

  /**
   * 估算内存使用量
   */
  private static estimateMemoryUsage(watermarkCount: number, config: PDFWatermarkConfig): number {
    // 每个水印大约使用的内存（KB）
    const memoryPerWatermark = (config.fontSize / 24) * 10; // 基础估算
    return watermarkCount * memoryPerWatermark;
  }

  /**
   * 解析颜色
   */
  private static parseColor(colorStr: string): { r: number; g: number; b: number } {
    const hex = colorStr.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b };
  }

  /**
   * Blob转ArrayBuffer
   */
  private static blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * DataURL转Uint8Array - 用于水印图像嵌入
   */
  private static dataURLToUint8Array(dataURL: string): Uint8Array {
    try {
      // 提取base64数据部分
      const base64 = dataURL.split(',')[1];
      if (!base64) {
        throw new Error('Invalid dataURL format');
      }
      
      // 解码base64
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes;
      
    } catch (error) {
      console.error('DataURL转换失败:', error);
      throw new Error(`DataURL转换失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从WatermarkSettings转换配置
   */
  static convertFromWatermarkSettings(settings: WatermarkSettings): PDFWatermarkConfig {
    const textColor = typeof settings.text?.color === 'string' 
      ? settings.text.color 
      : settings.text?.color?.primary || '#000000';

    let mode: 'single' | 'grid' | 'boundary' | 'adaptive' = 'single';
    
    // 根据位置设置确定模式
    switch (settings.position.placement) {
      case 'pattern':
        mode = 'grid';
        break;
      case 'corner':
      case 'edge':
        mode = 'boundary';
        break;
      case 'center':
      default:
        mode = 'single';
        break;
    }

    const config: PDFWatermarkConfig = {
      text: settings.text?.content || 'WATERMARK',
      fontSize: (settings.text?.font?.size || 24) * settings.position.scale,
      color: textColor,
      opacity: settings.position.opacity,
      rotation: settings.position.rotation || -45,
      mode
    };

    // 设置模式特定参数
    if (mode === 'grid' && settings.position.pattern) {
      config.grid = {
        spacingX: settings.position.pattern.spacing?.x || 200,
        spacingY: settings.position.pattern.spacing?.y || 150,
        offsetX: settings.position.pattern.offset?.x || 0,
        offsetY: settings.position.pattern.offset?.y || 0,
        stagger: settings.position.pattern.stagger || true
      };
    }

    return config;
  }

  /**
   * 预览水印布局
   */
  static previewWatermarkLayout(
    pageWidth: number,
    pageHeight: number,
    config: PDFWatermarkConfig
  ): Array<{ x: number; y: number; opacity: number }> {
    const positions: Array<{ x: number; y: number; opacity: number }> = [];

    // 这里简化实现，返回预计的水印位置用于预览
    switch (config.mode) {
      case 'single':
        positions.push({ x: pageWidth / 2, y: pageHeight / 2, opacity: config.opacity });
        break;
      
      case 'grid':
        const grid = { ...this.DEFAULT_CONFIG.grid, ...config.grid };
        const margin = 50;
        const cols = Math.floor((pageWidth - 2 * margin) / (grid.spacingX ?? 200)) + 1;
        const rows = Math.floor((pageHeight - 2 * margin) / (grid.spacingY ?? 150)) + 1;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            let x = margin + col * (grid.spacingX ?? 200) + (grid.offsetX || 0);
            let y = margin + row * (grid.spacingY ?? 150) + (grid.offsetY || 0);

            if (grid.stagger && row % 2 === 1) {
              x += (grid.spacingX ?? 200) / 2;
            }

            if (x >= margin && x <= pageWidth - margin && 
                y >= margin && y <= pageHeight - margin) {
              positions.push({ x, y, opacity: config.opacity });
            }
          }
        }
        break;
      
      // 其他模式的实现...
      default:
        positions.push({ x: pageWidth / 2, y: pageHeight / 2, opacity: config.opacity });
    }

    return positions;
  }

  /**
   * 创建带中文水印的PDF文档 - 完整流程方法
   */
  static async createWatermarkedPDFFromText(
    textContent: string,
    watermarkSettings: WatermarkSettings,
    options: {
      pageFormat?: 'A4' | 'Letter' | 'A3' | 'A5';
      orientation?: 'portrait' | 'landscape';
      fontSize?: number;
      fontColor?: string;
      lineSpacing?: number;
      margin?: number;
    } = {}
  ): Promise<{
    success: boolean;
    pdfBlob?: Blob;
    pageCount: number;
    watermarkCount: number;
    processingTime: number;
    error?: string;
  }> {
    const startTime = performance.now();
    
    try {
      // 确保引擎已初始化
      await this.initialize();
      
      // 创建新PDF文档
      const pdfDoc = await this.pdfLib.PDFDocument.create();
      
      // 注册字体支持
      if (this.fontkit) {
        pdfDoc.registerFontkit(this.fontkit);
      }
      
      // 获取页面尺寸
      const pageFormat = options.pageFormat || 'A4';
      const orientation = options.orientation || 'portrait';
      const pageDimensions = this.getPageDimensions(pageFormat, orientation);
      
      // 分页处理文本内容
      const pages = this.splitTextIntoPages(
        textContent, 
        pageDimensions, 
        options.margin || 50,
        options.fontSize || 12,
        options.lineSpacing || 1.2
      );
      
      console.log('📖 文本分页完成:', {
        totalPages: pages.length,
        pageFormat,
        orientation,
        averageContentLength: Math.round(pages.reduce((sum, page) => sum + page.length, 0) / pages.length)
      });
      
      // 转换水印设置
      const watermarkConfig = this.convertFromWatermarkSettings(watermarkSettings);
      let totalWatermarkCount = 0;
      
      // 为每页添加内容和水印
      for (let i = 0; i < pages.length; i++) {
        const pageContent = pages[i];
        
        // 添加页面
        const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height]);
        
        // 添加文本内容
        this.addTextContentToPage(page, pageContent, options);
        
        // 添加水印
        const pageWatermarkCount = await this.addWatermarksToPage(
          pdfDoc, 
          page, 
          watermarkConfig, 
          i + 1
        );
        
        totalWatermarkCount += pageWatermarkCount;
      }
      
      // 生成PDF字节数据
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const processingTime = performance.now() - startTime;
      
      const result = {
        success: true,
        pdfBlob,
        pageCount: pages.length,
        watermarkCount: totalWatermarkCount,
        processingTime
      };
      
      console.log('🎉 PDF创建完成:', result);
      return result;
      
    } catch (error) {
      console.error('❌ PDF创建失败:', error);
      
      return {
        success: false,
        pageCount: 0,
        watermarkCount: 0,
        processingTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取页面尺寸
   */
  private static getPageDimensions(
    format: string,
    orientation: string
  ): { width: number; height: number } {
    const formats = {
      'A4': { width: 595, height: 842 },
      'Letter': { width: 612, height: 792 },
      'Legal': { width: 612, height: 1008 },
      'A3': { width: 842, height: 1191 },
      'A5': { width: 420, height: 595 }
    };
    
    const size = formats[format as keyof typeof formats] || formats.A4;
    
    return orientation === 'landscape' 
      ? { width: size.height, height: size.width }
      : size;
  }

  /**
   * 将文本分页
   */
  private static splitTextIntoPages(
    content: string,
    pageDimensions: { width: number; height: number },
    margin: number,
    fontSize: number,
    lineSpacing: number
  ): string[] {
    const textWidth = pageDimensions.width - 2 * margin;
    const textHeight = pageDimensions.height - 2 * margin;
    const lineHeight = fontSize * lineSpacing;
    const linesPerPage = Math.floor(textHeight / lineHeight);
    const charsPerLine = Math.floor(textWidth / (fontSize * 0.6));
    const charsPerPage = linesPerPage * charsPerLine;
    
    const pages: string[] = [];
    let currentIndex = 0;
    
    while (currentIndex < content.length) {
      const pageContent = content.substring(currentIndex, currentIndex + charsPerPage);
      pages.push(pageContent);
      currentIndex += charsPerPage;
    }
    
    return pages;
  }

  /**
   * 向页面添加文本内容
   */
  private static addTextContentToPage(
    page: any,
    content: string,
    options: any
  ): void {
    const { height } = page.getSize();
    const fontSize = options.fontSize || 12;
    const margin = options.margin || 50;
    const lineSpacing = options.lineSpacing || 1.2;
    const fontColor = options.fontColor || '#000000';
    
    const lines = content.split('\n');
    const lineHeight = fontSize * lineSpacing;
    let y = height - margin - fontSize;
    
    const colorRgb = this.parseColor(fontColor);
    
    for (const line of lines) {
      if (y < margin) break; // 页面已满
      
      page.drawText(line, {
        x: margin,
        y: y,
        size: fontSize,
        color: this.pdfLib.rgb(colorRgb.r, colorRgb.g, colorRgb.b)
      });
      
      y -= lineHeight;
    }
  }

  /**
   * 获取引擎状态信息
   */
  static getEngineStatus(): {
    initialized: boolean;
    libraries: { name: string; available: boolean }[];
    features: string[];
    performance: {
      cdnLoadTime?: number;
      initializationTime?: number;
    };
  } {
    return {
      initialized: this.isInitialized,
      libraries: [
        { name: 'PDF-lib', available: !!this.pdfLib },
        { name: 'Fontkit', available: !!this.fontkit }
      ],
      features: [
        'PDF文档创建和编辑',
        '中文文本水印渲染',
        '网格布局水印',
        'Canvas高质量渲染',
        'CDN动态库加载',
        '多格式页面支持',
        '智能字体回退',
        this.fontkit ? '高级字体支持' : '基础字体支持'
      ],
      performance: {
        cdnLoadTime: LibraryLoader.getPerformanceMetrics().averageLoadTime,
        initializationTime: this.isInitialized ? 0 : undefined
      }
    };
  }
}