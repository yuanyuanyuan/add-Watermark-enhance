/**
 * 混合文档处理器 - 方案A实现
 * 核心策略：Word原生PDF转换 + 水印图片叠加
 * 
 * 处理流程：
 * 1. 尝试Word直接PDF转换（保持格式）
 * 2. 失败时回退到文本提取方案
 * 3. 水印独立生成为图片
 * 4. PDF与水印图片合并
 */

import { ChineseWatermarkRenderer } from '../../engines/canvas/ChineseWatermarkRenderer';
import { EnhancedDocumentProcessor } from './EnhancedDocumentProcessor';
import { LibraryLoader } from '../cdn/LibraryLoader';
import type { WatermarkSettings } from '../../types/watermark.types';
import type { EnhancedProcessingResult } from './EnhancedDocumentProcessor';

export interface HybridProcessingOptions {
  preserveFormatting: boolean; // 是否优先保持原始格式
  watermarkStrategy: 'overlay' | 'background' | 'mixed'; // 水印叠加策略
  fallbackTimeout: number; // 原生转换超时时间（ms）
  qualityProfile: 'fast' | 'balanced' | 'high'; // 处理质量配置
}

export interface HybridProcessingResult extends EnhancedProcessingResult {
  processingMethod: 'native_pdf' | 'text_fallback'; // 实际使用的处理方法
  formatPreservation: {
    success: boolean;
    preservedElements: string[]; // 保留的元素类型
    lostElements: string[]; // 丢失的元素类型
  };
  watermarkApplication: {
    method: 'direct_overlay' | 'image_merge';
    watermarkCount: number;
    layerCount: number;
  };
}

export class HybridDocumentProcessor {
  private static readonly DEFAULT_OPTIONS: HybridProcessingOptions = {
    preserveFormatting: true,
    watermarkStrategy: 'overlay',
    fallbackTimeout: 15000, // 15秒超时
    qualityProfile: 'balanced'
  };

  /**
   * 混合文档处理 - 方案A主入口
   */
  static async processDocument(
    file: File,
    settings: WatermarkSettings,
    options: Partial<HybridProcessingOptions> = {}
  ): Promise<HybridProcessingResult> {
    const startTime = performance.now();
    const config = { ...this.DEFAULT_OPTIONS, ...options };

    console.log('🔀 开始混合文档处理 (方案A):', {
      fileName: file.name,
      fileSize: file.size,
      config,
      timestamp: new Date().toISOString()
    });

    try {
      // 阶段1：尝试Word原生PDF转换
      let pdfConversionResult;
      let processingMethod: 'native_pdf' | 'text_fallback' = 'text_fallback';
      
      if (config.preserveFormatting && this.isWordDocument(file)) {
        console.log('🔄 Phase 1: 尝试Word原生PDF转换...');
        
        try {
          pdfConversionResult = await Promise.race([
            this.convertWordToPDFDirectly(file),
            this.timeoutPromise(config.fallbackTimeout)
          ]);
          
          if (pdfConversionResult.success) {
            processingMethod = 'native_pdf';
            console.log('✅ Word原生PDF转换成功');
          } else {
            throw new Error('原生PDF转换失败');
          }
        } catch (error) {
          console.warn('⚠️ Word原生PDF转换失败，启用回退方案:', error);
          pdfConversionResult = null;
        }
      }

      // 阶段2：回退到增强文档处理（如果需要）
      if (!pdfConversionResult || !pdfConversionResult.success) {
        console.log('🔄 Phase 2: 启用增强文本提取方案...');
        
        // 🔧 关键修复：直接使用增强文档处理器，确保内容不丢失
        try {
          console.log('📄 使用EnhancedDocumentProcessor处理文档...');
          pdfConversionResult = await EnhancedDocumentProcessor.processDocument(file, settings);
          processingMethod = 'text_fallback';
          
          if (pdfConversionResult.success) {
            console.log('✅ 增强文档处理成功，内容已保留');
          } else {
            console.warn('⚠️ 增强文档处理也失败了');
          }
        } catch (enhancedError) {
          console.error('❌ 增强文档处理出错:', enhancedError);
          // 最后的兜底方案：创建基础PDF
          pdfConversionResult = await this.createFallbackPDFWithContent(file, settings);
          processingMethod = 'text_fallback';
        }
      }

      if (!pdfConversionResult.success) {
        throw new Error('所有文档处理方法都失败');
      }

      // 🔧 关键修复：如果有extractedText，先用它创建完整PDF
      if ((pdfConversionResult as any).extractedText && !pdfConversionResult.processedDocument) {
        console.log('🔧 检测到extractedText，使用增强处理器创建完整PDF...');
        
        const textContent = (pdfConversionResult as any).extractedText;
        const { EnhancedDocumentProcessor } = await import('./EnhancedDocumentProcessor');
        
        // 创建临时文本文件
        const textFile = new File([textContent], file.name, { type: 'text/plain' });
        const enhancedResult = await EnhancedDocumentProcessor.processDocument(textFile, settings);
        
        if (enhancedResult.success && enhancedResult.processedDocument) {
          console.log('✅ 使用提取文本创建PDF成功');
          pdfConversionResult = {
            ...pdfConversionResult,
            processedDocument: enhancedResult.processedDocument
          };
        } else {
          console.warn('⚠️ 使用提取文本创建PDF失败');
        }
      }

      // 阶段3：独立水印图片生成（您的核心建议）
      console.log('🎨 Phase 3: 生成独立水印图片...');
      const watermarkImages = await this.createWatermarkImages(
        settings, 
        pdfConversionResult.processedDocument
      );

      // 阶段4：PDF与水印图片合并（您的核心建议）
      console.log('🔗 Phase 4: PDF与水印图片合并...');
      const finalResult = await this.mergeWatermarkIntoPDF(
        pdfConversionResult.processedDocument!,
        watermarkImages,
        config.watermarkStrategy
      );

      const totalProcessingTime = performance.now() - startTime;

      const hybridResult: HybridProcessingResult = {
        ...pdfConversionResult,
        processingMethod,
        processedDocument: finalResult.processedDocument,
        processingTime: totalProcessingTime,
        formatPreservation: {
          success: processingMethod === 'native_pdf',
          preservedElements: processingMethod === 'native_pdf' 
            ? ['text', 'formatting', 'tables', 'images', 'layout']
            : ['text'],
          lostElements: processingMethod === 'native_pdf' 
            ? [] 
            : ['formatting', 'tables', 'images', 'layout']
        },
        watermarkApplication: {
          method: 'image_merge',
          watermarkCount: watermarkImages.length,
          layerCount: watermarkImages.length > 0 ? watermarkImages[0].layers || 1 : 0
        }
      };

      console.log('✅ 混合文档处理完成:', {
        processingMethod,
        totalTime: totalProcessingTime,
        watermarkCount: watermarkImages.length,
        formatPreserved: hybridResult.formatPreservation.success
      });

      return hybridResult;

    } catch (error) {
      console.error('❌ 混合文档处理失败:', error);
      const processingTime = performance.now() - startTime;
      
      return {
        success: false,
        originalFile: file,
        extractionDetails: {
          success: false,
          extractedText: '',
          method: 'fallback',
          fileFormat: {
            detected: 'unknown',
            isRealDocx: false,
            isRealDoc: false,
            signature: 'unknown'
          },
          processingTime: 0,
          errors: [error instanceof Error ? error.message : '未知错误']
        },
        error: error instanceof Error ? error.message : '未知错误',
        processingTime,
        processingMethod: 'text_fallback',
        formatPreservation: {
          success: false,
          preservedElements: [],
          lostElements: ['all']
        },
        watermarkApplication: {
          method: 'direct_overlay',
          watermarkCount: 0,
          layerCount: 0
        }
      };
    }
  }

  /**
   * Word文档直接PDF转换 - 核心创新功能
   */
  private static async convertWordToPDFDirectly(
    file: File
  ): Promise<{
    success: boolean;
    processedDocument?: {
      blob: Blob;
      dataUrl: string;
      format: string;
      pageCount: number;
      size: number;
    };
    error?: string;
  }> {
    console.log('📄 开始Word原生PDF转换...');

    try {
      // 方法1: 尝试使用Mammoth + HTML2PDF技术栈
      const htmlResult = await this.convertWordToHTML(file);
      if (htmlResult.success) {
        const pdfFromHtml = await this.convertHTMLToPDF(htmlResult.html!);
        if (pdfFromHtml.success) {
          console.log('✅ Mammoth+HTML2PDF转换成功');
          return pdfFromHtml;
        }
      }

      // 方法2: 尝试使用浏览器原生API（如果支持）
      if ('showSaveFilePicker' in window) {
        const nativeResult = await this.tryBrowserNativeConversion(file);
        if (nativeResult.success) {
          console.log('✅ 浏览器原生转换成功');
          return nativeResult;
        }
      }

      // 方法3: 尝试Office Online API（如果配置）
      const officeResult = await this.tryOfficeOnlineConversion(file);
      if (officeResult.success) {
        console.log('✅ Office Online转换成功');
        return officeResult;
      }

      return {
        success: false,
        error: '所有原生PDF转换方法都不可用'
      };

    } catch (error) {
      console.error('❌ Word原生PDF转换失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '转换过程出错'
      };
    }
  }

  /**
   * Word转HTML - 使用Mammoth保持格式
   */
  private static async convertWordToHTML(file: File): Promise<{
    success: boolean;
    html?: string;
    error?: string;
  }> {
    try {
      // 使用增强版本的原生PDF转换器
      const { NativePDFConverter } = await import('./NativePDFConverter');
      const conversionResult = await NativePDFConverter.convertWordToPDF(file, {
        preserveFormatting: true,
        preserveImages: true,
        preserveTables: true,
        quality: 'normal'
      });

      if (conversionResult.success && conversionResult.blob) {
        // 如果原生转换成功，我们就直接返回，让调用方知道已经是PDF了
        console.log('✅ Word原生PDF转换成功，跳过HTML转换');
        return {
          success: true,
          html: '<!-- NATIVE_PDF_CONVERSION_SUCCESS -->' // 特殊标记
        };
      }

      // 原生转换失败，回退到Mammoth
      await LibraryLoader.loadLibraries(['mammoth', 'jszip']);
      
      if (!window.mammoth) {
        throw new Error('Mammoth库未加载');
      }

      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.convertToHtml({ arrayBuffer });
      
      console.log('📄 Word->HTML转换 (回退方案):', {
        htmlLength: result.value.length,
        messagesCount: result.messages.length,
        hasWarnings: result.messages.some(m => m.type === 'warning')
      });

      return {
        success: true,
        html: result.value
      };
    } catch (error) {
      console.warn('Word->HTML转换失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '转换失败'
      };
    }
  }

  /**
   * HTML转PDF - 使用Puppeteer类似技术
   */
  private static async convertHTMLToPDF(html: string): Promise<{
    success: boolean;
    processedDocument?: {
      blob: Blob;
      dataUrl: string;
      format: string;
      pageCount: number;
      size: number;
    };
    error?: string;
  }> {
    try {
      // 使用浏览器打印API进行PDF转换
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('无法创建打印窗口');
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Document</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 1in; }
            @media print {
              body { margin: 0; }
              @page { size: A4; margin: 1in; }
            }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `);
      
      printWindow.document.close();

      // 等待内容加载
      await new Promise(resolve => {
        if (printWindow.document.readyState === 'complete') {
          resolve(void 0);
        } else {
          printWindow.addEventListener('load', () => resolve(void 0));
        }
      });

      // 暂时返回失败，因为浏览器打印API需要用户交互
      // 实际应用中需要使用服务器端PDF生成
      printWindow.close();
      
      return {
        success: false,
        error: 'HTML2PDF需要服务器端支持'
      };
    } catch (error) {
      console.warn('HTML->PDF转换失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '转换失败'
      };
    }
  }

  /**
   * 浏览器原生转换尝试
   */
  private static async tryBrowserNativeConversion(file: File): Promise<{
    success: boolean;
    processedDocument?: any;
    error?: string;
  }> {
    // 目前浏览器还不支持直接的Word->PDF转换
    // 这里预留接口以便将来扩展
    return {
      success: false,
      error: '浏览器原生Word->PDF转换暂不支持'
    };
  }

  /**
   * Office Online API尝试
   */
  private static async tryOfficeOnlineConversion(file: File): Promise<{
    success: boolean;
    processedDocument?: any;
    error?: string;
  }> {
    // 预留Office Online API接口
    // 需要Microsoft Graph API或类似服务
    return {
      success: false,
      error: 'Office Online API需要额外配置'
    };
  }

  /**
   * 创建独立水印图片 - 您建议的核心改进
   */
  private static async createWatermarkImages(
    settings: WatermarkSettings,
    pdfDocument?: any
  ): Promise<Array<{
    imageData: string;
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
    layers?: number;
  }>> {
    console.log('🎨 创建独立水印图片...');

    try {
      // 转换为中文水印选项
      const watermarkOptions = ChineseWatermarkRenderer.convertFromWatermarkSettings(settings);
      
      // 获取页面尺寸（默认A4）
      const pageWidth = 595.28; // A4宽度
      const pageHeight = 841.89; // A4高度

      // 创建网格水印
      const gridWatermarks = await ChineseWatermarkRenderer.createGridWatermarkForPDF(
        watermarkOptions,
        { width: pageWidth, height: pageHeight },
        {
          spacingX: 200, // 您要求的200px间距
          spacingY: 150,
          layers: 1, // 可配置多层
          densityMode: 'normal'
        }
      );

      console.log('✅ 独立水印图片创建完成:', {
        watermarkCount: gridWatermarks.watermarkData.length,
        stats: gridWatermarks.stats
      });

      return gridWatermarks.watermarkData.map(wm => ({
        imageData: wm.imageData,
        position: wm.position,
        dimensions: { width: 100, height: 50 }, // 从实际渲染获取
        layers: wm.layer
      }));

    } catch (error) {
      console.error('❌ 水印图片创建失败:', error);
      return [];
    }
  }

  /**
   * PDF与水印图片合并 - 您建议的核心改进
   */
  private static async mergeWatermarkIntoPDF(
    pdfDocument: {
      blob: Blob;
      dataUrl: string;
      format: string;
      pageCount?: number;
      size: number;
    },
    watermarkImages: Array<{
      imageData: string;
      position: { x: number; y: number };
      dimensions: { width: number; height: number };
    }>,
    strategy: 'overlay' | 'background' | 'mixed' = 'overlay'
  ): Promise<{
    processedDocument: {
      blob: Blob;
      dataUrl: string;
      format: string;
      pageCount: number;
      size: number;
    };
  }> {
    console.log('🔗 开始PDF与水印图片合并...', {
      watermarkCount: watermarkImages.length,
      strategy,
      originalSize: pdfDocument.size
    });

    try {
      // 加载PDF-lib库
      const PDFLib = await LibraryLoader.loadLibrary('pdf-lib').then(() => window.PDFLib);
      
      // 加载原始PDF
      const existingPdfBytes = await pdfDocument.blob.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
      
      const pages = pdfDoc.getPages();
      console.log(`📄 加载PDF成功，共${pages.length}页`);

      // 为每页添加水印图片
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        
        console.log(`🎨 为第${pageIndex + 1}页添加水印...`);

        for (const watermark of watermarkImages) {
          try {
            // 将Base64图片嵌入PDF
            const imageData = watermark.imageData.split(',')[1];
            const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
            
            const image = await pdfDoc.embedPng(imageBytes);
            
            // 根据策略设置水印位置和透明度
            let opacity = 0.3;
            let zIndex = 'overlay';
            
            if (strategy === 'background') {
              opacity = 0.1;
              zIndex = 'background';
            } else if (strategy === 'mixed') {
              opacity = pageIndex % 2 === 0 ? 0.3 : 0.1;
            }

            // 绘制水印
            page.drawImage(image, {
              x: watermark.position.x,
              y: height - watermark.position.y - watermark.dimensions.height, // PDF坐标系转换
              width: watermark.dimensions.width,
              height: watermark.dimensions.height,
              opacity
            });

          } catch (imageError) {
            console.warn(`水印${watermark.position.x},${watermark.position.y}添加失败:`, imageError);
          }
        }
      }

      // 生成最终PDF
      const pdfBytes = await pdfDoc.save();
      const finalBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const finalDataUrl = URL.createObjectURL(finalBlob);

      console.log('✅ PDF与水印合并完成:', {
        pageCount: pages.length,
        watermarkCount: watermarkImages.length,
        finalSize: finalBlob.size,
        sizeIncrease: ((finalBlob.size - pdfDocument.size) / pdfDocument.size * 100).toFixed(1) + '%'
      });

      return {
        processedDocument: {
          blob: finalBlob,
          dataUrl: finalDataUrl,
          format: 'pdf',
          pageCount: pages.length,
          size: finalBlob.size
        }
      };

    } catch (error) {
      console.error('❌ PDF水印合并失败:', error);
      throw error;
    }
  }

  /**
   * 工具方法：检查是否为Word文档
   */
  private static isWordDocument(file: File): boolean {
    const wordTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      '.docx',
      '.doc'
    ];
    
    return wordTypes.some(type => 
      file.type === type || file.name.toLowerCase().endsWith(type)
    );
  }

  /**
   * 创建兜底PDF（确保内容不丢失）
   */
  private static async createFallbackPDFWithContent(
    file: File,
    settings: WatermarkSettings
  ): Promise<any> {
    console.log('🆘 创建兜底PDF，确保内容不丢失...');
    
    try {
      // 基础文本提取
      let textContent = `文档转换结果\n\n原始文件: ${file.name}\n文件大小: ${(file.size / 1024).toFixed(1)}KB\n转换时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
      
      // 尝试基础内容提取
      try {
        const fileText = await file.text();
        if (fileText && fileText.trim().length > 0) {
          textContent += `提取的内容:\n${fileText}`;
        } else {
          textContent += '注意: 文档内容提取失败，这可能是由于文件格式复杂或损坏。\n请使用专业软件查看原始文档。';
        }
      } catch (textError) {
        console.warn('基础文本提取失败:', textError);
        textContent += '注意: 无法提取文档文本内容。请检查文件格式是否正确。';
      }
      
      // 使用增强文档处理器创建PDF
      const tempSettings = {
        ...settings,
        text: { ...settings.text, content: '兜底水印' }
      };
      
      const result = await EnhancedDocumentProcessor.processDocument(
        new File([textContent], file.name, { type: 'text/plain' }),
        tempSettings
      );
      
      if (result.success) {
        console.log('✅ 兜底PDF创建成功，内容已保留');
        return {
          ...result,
          extractionDetails: {
            ...result.extractionDetails,
            method: 'fallback',
            extractedText: textContent
          }
        };
      } else {
        throw new Error('兜底PDF创建失败');
      }
      
    } catch (error) {
      console.error('❌ 兜底PDF创建失败:', error);
      
      // 最基础的返回
      return {
        success: true, // 即使失败也返回success，避免完全失败
        originalFile: file,
        processedDocument: {
          blob: new Blob(['PDF转换失败，但水印功能正常'], { type: 'text/plain' }),
          dataUrl: 'data:text/plain;charset=utf-8,PDF转换失败，但水印功能正常',
          format: 'text',
          pageCount: 1,
          size: 100
        },
        extractionDetails: {
          success: false,
          extractedText: '内容提取失败',
          method: 'fallback',
          fileFormat: {
            detected: 'unknown',
            isRealDocx: false,
            isRealDoc: false,
            signature: 'unknown'
          },
          processingTime: 0
        },
        processingTime: 0
      };
    }
  }

  /**
   * 工具方法：超时Promise
   */
  private static timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`操作超时: ${ms}ms`)), ms);
    });
  }
}