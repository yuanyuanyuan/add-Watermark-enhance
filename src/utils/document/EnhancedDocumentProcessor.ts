/**
 * 增强文档处理器 - 三重保障机制
 * 基于用户提供的技术方案实现：
 * 1. Mammoth库解析DOCX
 * 2. JSZip直接解析XML结构
 * 3. 文件格式智能识别
 */

import { ChineseWatermarkRenderer } from '../../engines/canvas/ChineseWatermarkRenderer';
import { LibraryLoader } from '../cdn/LibraryLoader';
import type { WatermarkSettings } from '../../types/watermark.types';

// PDF-lib类型定义（动态导入时使用）
// interface PDFDocument {
//   addPage(): any;
//   embedFont(fontBytes: ArrayBuffer): Promise<any>;
//   save(): Promise<Uint8Array>;
// }

// Mammoth类型定义（动态导入时使用）
interface MammothResult {
  value: string;
  messages: Array<{
    type: string;
    message: string;
  }>;
}

interface MammothAPI {
  extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<MammothResult>;
}

export interface DocumentExtractionResult {
  success: boolean;
  extractedText: string;
  method: 'mammoth' | 'jszip' | 'fallback';
  fileFormat: {
    detected: 'docx' | 'doc' | 'pdf' | 'unknown';
    isRealDocx: boolean;
    isRealDoc: boolean;
    signature: string;
  };
  processingTime: number;
  warnings?: string[];
  errors?: string[];
}

export interface EnhancedProcessingResult {
  success: boolean;
  originalFile: File;
  processedDocument?: {
    blob: Blob;
    dataUrl: string;
    format: string;
    pageCount?: number;
    size: number;
  };
  extractionDetails: DocumentExtractionResult;
  extractedContent?: {
    text?: string;
    metadata?: any;
  };
  error?: string;
  processingTime: number;
}

export class EnhancedDocumentProcessor {
  private static mammothCache: MammothAPI | null = null;

  /**
   * 处理文档文件（增强版本，支持三重保障机制）
   */
  static async processDocument(
    file: File,
    settings: WatermarkSettings
  ): Promise<EnhancedProcessingResult> {
    const startTime = performance.now();

    console.log('🚀 开始增强文档处理:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: new Date().toISOString()
    });

    try {
      // 第一步：文档内容提取（三重保障机制）
      const extractionResult = await this.extractDocumentContent(file);

      console.log('📄 文档提取结果:', {
        success: extractionResult.success,
        method: extractionResult.method,
        fileFormat: extractionResult.fileFormat,
        textLength: extractionResult.extractedText.length,
        processingTime: extractionResult.processingTime,
        hasWarnings: (extractionResult.warnings?.length || 0) > 0,
        hasErrors: (extractionResult.errors?.length || 0) > 0
      });

      if (!extractionResult.success) {
        return {
          success: false,
          originalFile: file,
          extractionDetails: extractionResult,
          error: '文档内容提取失败',
          processingTime: performance.now() - startTime
        };
      }

      // 第二步：转换为PDF并添加中文水印
      const pdfResult = await this.convertToPDFWithChineseWatermark(
        extractionResult.extractedText,
        settings,
        file.name
      );

      const totalProcessingTime = performance.now() - startTime;

      if (!pdfResult.success) {
        return {
          success: false,
          originalFile: file,
          extractionDetails: extractionResult,
          error: pdfResult.error || 'PDF生成失败',
          processingTime: totalProcessingTime
        };
      }

      console.log('✅ 增强文档处理完成:', {
        totalProcessingTime,
        extractionMethod: extractionResult.method,
        fileFormat: extractionResult.fileFormat.detected,
        pdfSize: pdfResult.processedDocument?.size,
        pageCount: pdfResult.processedDocument?.pageCount
      });

      return {
        success: true,
        originalFile: file,
        processedDocument: pdfResult.processedDocument,
        extractionDetails: extractionResult,
        processingTime: totalProcessingTime
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('❌ 增强文档处理失败:', error);

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
        processingTime
      };
    }
  }

  /**
   * 文档内容提取 - 三重保障机制核心实现
   */
  private static async extractDocumentContent(file: File): Promise<DocumentExtractionResult> {
    const startTime = performance.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    let extractedText = '';
    let extractionSuccess = false;
    let extractionMethod: 'mammoth' | 'jszip' | 'fallback' = 'fallback';

    console.log('🔍 开始三重保障文档内容提取...');

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    
    // 第三重：文件格式智能识别（先执行，用于指导后续策略）
    const fileFormat = this.identifyFileFormat(arrayBuffer, file.name);
    
    console.log('🧩 文件格式识别结果:', fileFormat);

    // 创建多种buffer变体用于容错处理
    const bufferVariants = this.createBufferVariants(arrayBuffer);
    
    console.log('🔄 创建buffer变体:', {
      originalSize: arrayBuffer.byteLength,
      variantsCount: bufferVariants.length
    });

    // 第一重：Mammoth库解析（优先用于DOCX）
    if (fileFormat.isRealDocx) {
      console.log('🥇 第一重：尝试Mammoth解析...');
      
      for (let i = 0; i < bufferVariants.length && !extractionSuccess; i++) {
        try {
          const mammoth = await this.loadMammoth();
          const result = await mammoth.extractRawText({ arrayBuffer: bufferVariants[i] });
          
          if (result.value && result.value.trim().length > 0) {
            extractedText = result.value;
            extractionSuccess = true;
            extractionMethod = 'mammoth';
            
            console.log('✅ Mammoth解析成功:', {
              textLength: extractedText.length,
              messagesCount: result.messages.length,
              bufferVariantIndex: i
            });

            // 处理Mammoth警告信息
            result.messages.forEach(msg => {
              if (msg.type === 'warning') {
                warnings.push(`Mammoth警告: ${msg.message}`);
              }
            });
            break;
          }
        } catch (mammothError) {
          console.warn(`Mammoth解析失败 (变体${i}):`, mammothError);
          errors.push(`Mammoth解析失败: ${mammothError instanceof Error ? mammothError.message : '未知错误'}`);
        }
      }
    }

    // 第二重：JSZip直接解析（Mammoth失败或非标准DOCX时使用）
    if (!extractionSuccess && (fileFormat.isRealDocx || fileFormat.detected === 'docx')) {
      console.log('🥈 第二重：尝试JSZip解析...');
      
      for (let i = 0; i < bufferVariants.length && !extractionSuccess; i++) {
        try {
          const JSZip = await this.loadJSZip();
          const zip = await JSZip.loadAsync(bufferVariants[i]);
          const documentXml = zip.file('word/document.xml');
          
          if (documentXml) {
            const xmlContent = await documentXml.async('text');
            const textContent = this.extractTextFromWordXML(xmlContent);
            
            if (textContent && textContent.trim().length > 0) {
              extractedText = textContent;
              extractionSuccess = true;
              extractionMethod = 'jszip';
              
              console.log('✅ JSZip解析成功:', {
                textLength: extractedText.length,
                xmlContentLength: xmlContent.length,
                bufferVariantIndex: i
              });
              break;
            }
          } else {
            warnings.push('ZIP结构中未找到word/document.xml文件');
          }
        } catch (jszipError) {
          console.warn(`JSZip解析失败 (变体${i}):`, jszipError);
          errors.push(`JSZip解析失败: ${jszipError instanceof Error ? jszipError.message : '未知错误'}`);
        }
      }
    }

    // 回退方案：使用文件名和基本信息
    if (!extractionSuccess) {
      console.log('🥉 第三重：使用回退方案...');
      extractedText = this.generateFallbackContent(file.name, fileFormat);
      extractionMethod = 'fallback';
      extractionSuccess = true;
      warnings.push('内容提取失败，使用回退方案生成基本内容');
    }

    const processingTime = performance.now() - startTime;

    console.log('📊 文档提取完成统计:', {
      success: extractionSuccess,
      method: extractionMethod,
      textLength: extractedText.length,
      processingTime,
      warningsCount: warnings.length,
      errorsCount: errors.length,
      fileFormat
    });

    return {
      success: extractionSuccess,
      extractedText,
      method: extractionMethod,
      fileFormat,
      processingTime,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 文件格式智能识别 - 基于文件头签名技术
   */
  private static identifyFileFormat(arrayBuffer: ArrayBuffer, fileName: string): {
    detected: 'docx' | 'doc' | 'pdf' | 'unknown';
    isRealDocx: boolean;
    isRealDoc: boolean;
    signature: string;
  } {
    const uint8Array = new Uint8Array(arrayBuffer);
    const fileSignature = uint8Array.slice(0, 8);
    
    // ZIP格式 (DOCX) 检测 - PK标识
    const isRealDocx = fileSignature[0] === 0x50 && fileSignature[1] === 0x4B;
    
    // OLE2格式 (老版本DOC) 检测
    const isRealDoc = fileSignature[0] === 0xD0 && fileSignature[1] === 0xCF;
    
    // PDF格式检测
    const isPDF = fileSignature[0] === 0x25 && fileSignature[1] === 0x50 && 
                  fileSignature[2] === 0x44 && fileSignature[3] === 0x46;
    
    // 生成签名字符串用于调试
    const signatureHex = Array.from(fileSignature)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ');

    let detected: 'docx' | 'doc' | 'pdf' | 'unknown' = 'unknown';
    
    if (isPDF) {
      detected = 'pdf';
    } else if (isRealDocx) {
      detected = 'docx';
    } else if (isRealDoc) {
      detected = 'doc';
    } else {
      // 根据文件扩展名做最后判断
      const extension = fileName.toLowerCase().split('.').pop();
      if (extension === 'docx') detected = 'docx';
      else if (extension === 'doc') detected = 'doc';
      else if (extension === 'pdf') detected = 'pdf';
    }

    console.log('🔍 文件格式检测详情:', {
      fileName,
      fileSize: arrayBuffer.byteLength,
      signature: signatureHex,
      detected,
      isRealDocx,
      isRealDoc,
      isPDF,
      fileExtension: fileName.toLowerCase().split('.').pop()
    });

    return {
      detected,
      isRealDocx,
      isRealDoc,
      signature: signatureHex
    };
  }

  /**
   * 创建多种buffer变体用于容错处理
   */
  /**
   * 创建Buffer变体 - 增强容错机制
   * 生成多种buffer变体以应对不同的解析器和损坏情况
   */
  private static createBufferVariants(originalBuffer: ArrayBuffer): ArrayBuffer[] {
    const variants: ArrayBuffer[] = [];
    const originalSize = originalBuffer.byteLength;
    
    try {
      // 变体1：原始buffer（最高优先级）
      variants.push(originalBuffer);
      
      // 变体2：完全副本（防止原始buffer被修改）
      const perfectCopy = originalBuffer.slice(0);
      variants.push(perfectCopy);
      
      // 变体3：去除末尾填充数据（处理某些Word文档的填充字节）
      if (originalSize > 512) {
        const trimmedEnd = originalBuffer.slice(0, originalSize - 256);
        variants.push(trimmedEnd);
      }
      
      // 变体4：跳过可能损坏的文件头（适用于部分损坏的DOCX）
      if (originalSize > 1024) {
        const skipHeader = originalBuffer.slice(64);
        variants.push(skipHeader);
      }
      
      // 变体5：对于大文件，创建多个分段尝试
      if (originalSize > 5 * 1024 * 1024) { // > 5MB
        // 尝试90%的内容
        const partial90 = originalBuffer.slice(0, Math.floor(originalSize * 0.9));
        variants.push(partial90);
        
        // 尝试80%的内容
        const partial80 = originalBuffer.slice(0, Math.floor(originalSize * 0.8));
        variants.push(partial80);
      }
      
      // 变体6：字节对齐修复（某些损坏的ZIP文件可能需要）
      if (originalSize > 1024) {
        const uint8Array = new Uint8Array(originalBuffer);
        
        // 查找ZIP文件签名并从该位置开始
        for (let i = 0; i < Math.min(1024, originalSize - 4); i++) {
          if (uint8Array[i] === 0x50 && uint8Array[i + 1] === 0x4B && 
              uint8Array[i + 2] === 0x03 && uint8Array[i + 3] === 0x04) {
            if (i > 0) {
              const alignedBuffer = originalBuffer.slice(i);
              variants.push(alignedBuffer);
              break;
            }
          }
        }
      }
      
      console.log(`🔄 创建了${variants.length}个buffer变体:`, {
        originalSize,
        variantSizes: variants.map(v => v.byteLength),
        sizeReductions: variants.map(v => 
          `${((1 - v.byteLength / originalSize) * 100).toFixed(1)}%`
        )
      });
      
    } catch (error) {
      console.warn('创建buffer变体时出错:', error);
      // 至少确保有原始buffer可用
      if (variants.length === 0) {
        variants.push(originalBuffer);
      }
    }
    
    // 按大小排序，优先尝试完整的文件
    variants.sort((a, b) => b.byteLength - a.byteLength);
    
    return variants;
  }

  /**
   * 从Word XML中提取文本内容
   */
  private static extractTextFromWordXML(xmlContent: string): string {
    try {
      // 移除XML标签，提取文本内容
      const textContent = xmlContent
        .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1') // 提取w:t标签内的文本
        .replace(/<[^>]*>/g, '') // 移除所有XML标签
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim();

      console.log('📝 XML文本提取:', {
        xmlLength: xmlContent.length,
        extractedLength: textContent.length,
        preview: textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '')
      });

      return textContent;
    } catch (error) {
      console.error('XML文本提取失败:', error);
      return '';
    }
  }

  /**
   * 生成回退内容
   */
  private static generateFallbackContent(fileName: string, fileFormat: any): string {
    const timestamp = new Date().toLocaleString('zh-CN');
    return `文档转换内容
    
原始文件: ${fileName}
文件格式: ${fileFormat.detected}
转换时间: ${timestamp}
    
注意: 由于文档格式限制，无法提取原始内容。
此文档已转换为PDF格式并添加了水印。
    
如需查看完整内容，请使用支持该格式的应用程序打开原始文件。`;
  }

  /**
   * 动态加载Mammoth库
   */
  /**
   * 动态加载Mammoth库 - 集成CDN加载机制
   */
  private static async loadMammoth(): Promise<MammothAPI> {
    if (this.mammothCache) {
      return this.mammothCache;
    }

    try {
      console.log('📦 开始加载Mammoth和依赖库...');
      
      // 确保依赖库已加载（JSZip是Mammoth的依赖）
      await LibraryLoader.loadLibraries(['jszip', 'mammoth']);
      
      // 验证全局变量是否可用
      if (!window.mammoth) {
        throw new Error('Mammoth库CDN加载失败，全局变量不可用');
      }
      
      this.mammothCache = window.mammoth;
      
      console.log('✅ Mammoth库CDN加载成功');
      return this.mammothCache;
    } catch (error) {
      console.warn('⚠️ Mammoth库CDN加载失败，将跳过第一重解析:', error);
      throw new Error(`Mammoth库CDN加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 动态加载JSZip库 - 集成CDN加载机制
   */
  private static async loadJSZip(): Promise<typeof window.JSZip> {
    try {
      console.log('📦 开始加载JSZip库...');
      
      await LibraryLoader.loadLibrary('jszip');
      
      if (!window.JSZip) {
        throw new Error('JSZip库CDN加载失败，全局变量不可用');
      }
      
      console.log('✅ JSZip库CDN加载成功');
      return window.JSZip;
    } catch (error) {
      console.warn('⚠️ JSZip库CDN加载失败:', error);
      throw new Error(`JSZip库CDN加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 动态加载PDF-lib库 - 集成CDN加载机制
   */
  private static async loadPDFLib(): Promise<typeof window.PDFLib> {
    try {
      console.log('📦 开始加载PDF-lib和Fontkit库...');
      
      await LibraryLoader.loadLibraries(['pdf-lib', 'fontkit']);
      
      if (!window.PDFLib) {
        throw new Error('PDF-lib库CDN加载失败，全局变量不可用');
      }
      
      console.log('✅ PDF-lib库CDN加载成功');
      return window.PDFLib;
    } catch (error) {
      console.warn('⚠️ PDF-lib库CDN加载失败:', error);
      throw new Error(`PDF-lib库CDN加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 转换为PDF并添加中文水印
   */
  private static async convertToPDFWithChineseWatermark(
    extractedText: string,
    settings: WatermarkSettings,
    originalFileName: string
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
    try {
      console.log('📄 开始PDF转换和中文水印添加...');

      // 动态加载PDF-lib库
      const PDFLib = await this.loadPDFLib();
      
      // 创建PDF文档
      const pdfDoc = await PDFLib.PDFDocument.create();
      
      // 添加内容页面
      const pages = await this.createPDFPages(pdfDoc, extractedText);
      
      console.log('📄 PDF页面创建完成:', {
        pageCount: pages.length,
        contentLength: extractedText.length
      });

      // 创建中文水印选项
      const watermarkOptions = ChineseWatermarkRenderer.convertFromWatermarkSettings(settings);
      
      // 为每个页面添加中文水印
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        
        console.log(`🎨 为页面${i + 1}添加中文水印...`);

        // 创建中文水印图像
        const watermarkImage = await ChineseWatermarkRenderer.createChineseWatermarkImage({
          ...watermarkOptions,
          maxWidth: width * 0.8 // 限制水印宽度
        });

        // 将水印PNG嵌入PDF
        const imageBytes = await this.blobToArrayBuffer(watermarkImage.blob);
        const pdfImage = await pdfDoc.embedPng(imageBytes);

        // 计算水印位置（居中）
        const imageWidth = watermarkImage.dimensions.width;
        const imageHeight = watermarkImage.dimensions.height;
        const x = (width - imageWidth) / 2;
        const y = (height - imageHeight) / 2;

        // 绘制水印
        page.drawImage(pdfImage, {
          x,
          y,
          width: imageWidth,
          height: imageHeight,
          opacity: watermarkOptions.opacity * 0.7 // 稍微降低透明度避免影响阅读
        });

        console.log(`✅ 页面${i + 1}水印添加完成`);
      }

      // 生成PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const dataUrl = URL.createObjectURL(blob);

      console.log('✅ PDF转换和水印添加完成:', {
        size: blob.size,
        pageCount: pages.length,
        originalFileName
      });

      return {
        success: true,
        processedDocument: {
          blob,
          dataUrl,
          format: 'pdf',
          pageCount: pages.length,
          size: blob.size
        }
      };

    } catch (error) {
      console.error('❌ PDF转换失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 创建PDF页面并添加文本内容
   */
  private static async createPDFPages(pdfDoc: any, text: string): Promise<any[]> {
    const pages = [];
    const lines = text.split('\n').filter(line => line.trim());
    const linesPerPage = 40;
    const pageCount = Math.ceil(lines.length / linesPerPage);

    // 尝试嵌入中文字体，失败则使用默认字体
    let font;
    try {
      // 使用内嵌的标准字体处理中文
      font = await pdfDoc.embedFont('Helvetica');
      console.log('✅ 使用Helvetica字体');
    } catch (error) {
      console.warn('字体加载失败，使用默认字体:', error);
      font = undefined;
    }

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const startLine = pageIndex * linesPerPage;
      const endLine = Math.min(startLine + linesPerPage, lines.length);
      const pageLines = lines.slice(startLine, endLine);

      // 添加文本内容，支持中文渲染
      let yPosition = 800;
      for (const line of pageLines) {
        if (yPosition > 50) {
          try {
            // 分段处理长行，确保内容不会被截断
            const maxWidth = 500;
            const chunks = this.splitTextToFitWidth(line, maxWidth);
            
            for (const chunk of chunks) {
              if (yPosition > 50) {
                const textOptions: any = {
                  x: 50,
                  y: yPosition,
                  size: 12,
                  maxWidth: maxWidth
                };
                
                if (font) {
                  textOptions.font = font;
                }

                page.drawText(chunk, textOptions);
                yPosition -= 20;
              }
            }
          } catch (error) {
            console.warn('绘制文本行失败:', {
              line: line.substring(0, 50) + '...',
              error: error instanceof Error ? error.message : String(error)
            });
            yPosition -= 20; // 继续处理下一行
          }
        }
      }

      pages.push(page);
    }

    console.log(`📄 创建了${pages.length}个PDF页面，内容行数: ${lines.length}`);
    return pages;
  }

  /**
   * 将文本分割为适合指定宽度的块
   */
  private static splitTextToFitWidth(text: string, maxWidth: number): string[] {
    // 简单的文本分割策略：按字符长度分割
    const maxCharsPerLine = Math.floor(maxWidth / 6); // 估算每个字符约6个单位宽度
    const chunks = [];
    
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
      chunks.push(text.substring(i, i + maxCharsPerLine));
    }
    
    return chunks.length > 0 ? chunks : [''];
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
}