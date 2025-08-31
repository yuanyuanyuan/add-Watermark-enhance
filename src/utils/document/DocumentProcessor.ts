/**
 * 文档处理器 - 支持PDF和Word文档水印添加
 * 扩展水印功能以支持文档格式
 */

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { SimpleWatermarkProcessor, type SimpleWatermarkSettings } from '../watermark/SimpleWatermarkProcessor';

// 配置PDF.js worker - 使用稳定的备用CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export interface DocumentProcessorResult {
  success: boolean;
  originalFile: File;
  processedPages?: Array<{
    pageNumber: number;
    canvas: HTMLCanvasElement;
    dataUrl: string;
    blob: Blob;
  }>;
  processedDocument?: {
    blob: Blob;
    dataUrl?: string;
    format: string;
    pageCount: number;
  };
  error?: string;
  processingTime: number;
}

export class DocumentProcessor {
  private _watermarkProcessor: SimpleWatermarkProcessor;

  constructor() {
    this._watermarkProcessor = new SimpleWatermarkProcessor();
  }

  /**
   * 获取水印处理器实例
   */
  public getWatermarkProcessor(): SimpleWatermarkProcessor {
    return this._watermarkProcessor;
  }

  /**
   * 处理文档文件（PDF或Word）
   */
  async processDocument(
    file: File, 
    settings: SimpleWatermarkSettings
  ): Promise<DocumentProcessorResult> {
    const startTime = performance.now();

    try {
      const fileType = this.getFileType(file);
      
      if (fileType === 'pdf') {
        return await this.processPDF(file, settings, startTime);
      } else if (fileType === 'word') {
        return await this.processWord(file, settings, startTime);
      } else {
        throw new Error(`不支持的文档格式: ${file.type}`);
      }
    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('文档处理失败:', error);
      
      return {
        success: false,
        originalFile: file,
        error: error instanceof Error ? error.message : '未知错误',
        processingTime
      };
    }
  }

  /**
   * 处理PDF文档
   */
  private async processPDF(
    file: File,
    settings: SimpleWatermarkSettings,
    startTime: number
  ): Promise<DocumentProcessorResult> {
    console.log('🔄 开始PDF处理:', {
      fileName: file.name,
      fileSize: file.size,
      workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc
    });

    try {
      // 加载PDF文档
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const processedPages = [];
    const pageCount = pdf.numPages;

    // 逐页处理
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 高分辨率

      // 创建Canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('无法创建Canvas上下文');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // 渲染PDF页面到Canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      } as any; // PDF.js RenderParameters type
      await page.render(renderContext).promise;

      // 添加水印
      await this.addWatermarkToCanvas(context, canvas, settings);

      // 转换为数据URL和Blob
      const dataUrl = canvas.toDataURL('image/png', 0.9);
      const blob = await this.canvasToBlob(canvas, 'png', 0.9);

      processedPages.push({
        pageNumber: pageNum,
        canvas,
        dataUrl,
        blob
      });
    }

    const processingTime = performance.now() - startTime;

      return {
        success: true,
        originalFile: file,
        processedPages,
        processedDocument: {
          blob: processedPages[0].blob, // 第一页作为主要输出
          format: 'png',
          pageCount
        },
        processingTime
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('❌ PDF处理失败:', error);
      
      return {
        success: false,
        originalFile: file,
        error: error instanceof Error ? error.message : 'PDF处理失败',
        processingTime
      };
    }
  }

  /**
   * 处理Word文档
   */
  private async processWord(
    file: File,
    settings: SimpleWatermarkSettings,
    startTime: number
  ): Promise<DocumentProcessorResult> {
    // 使用mammoth将Word转换为HTML
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    if (result.messages.length > 0) {
      console.warn('Word转换警告:', result.messages);
    }

    // 创建临时HTML容器来渲染Word内容
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = result.value;
    tempDiv.style.width = '800px';
    tempDiv.style.padding = '40px';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.lineHeight = '1.6';

    // 添加到DOM中以便计算尺寸
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
      // 创建Canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('无法创建Canvas上下文');
      }

      // 设置Canvas尺寸
      canvas.width = 800;
      canvas.height = Math.max(tempDiv.scrollHeight + 80, 600);

      // 填充白色背景
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // 渲染HTML内容到Canvas（简化版本，主要处理文本）
      await this.renderHtmlToCanvas(context, tempDiv, canvas);

      // 添加水印
      await this.addWatermarkToCanvas(context, canvas, settings);

      // 转换为数据URL和Blob
      const dataUrl = canvas.toDataURL('image/png', 0.9);
      const blob = await this.canvasToBlob(canvas, 'png', 0.9);

      const processingTime = performance.now() - startTime;

      return {
        success: true,
        originalFile: file,
        processedPages: [{
          pageNumber: 1,
          canvas,
          dataUrl,
          blob
        }],
        processedDocument: {
          blob,
          dataUrl,
          format: 'png',
          pageCount: 1
        },
        processingTime
      };

    } finally {
      // 清理临时DOM元素
      document.body.removeChild(tempDiv);
    }
  }

  /**
   * 简化的HTML到Canvas渲染（主要处理文本）
   */
  private async renderHtmlToCanvas(
    context: CanvasRenderingContext2D,
    htmlElement: HTMLElement,
    canvas: HTMLCanvasElement
  ): Promise<void> {
    context.fillStyle = '#333333';
    context.font = '14px Arial';
    
    const text = htmlElement.textContent || '';
    const words = text.split(' ');
    const lineHeight = 20;
    const maxWidth = canvas.width - 80;
    let y = 60;
    let line = '';

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = context.measureText(testLine);
      
      if (metrics.width > maxWidth && line !== '') {
        context.fillText(line, 40, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      context.fillText(line, 40, y);
    }
  }

  /**
   * 在Canvas上添加水印
   */
  private async addWatermarkToCanvas(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    settings: SimpleWatermarkSettings
  ): Promise<void> {
    // 保存当前状态
    context.save();
    
    // 设置全局透明度
    context.globalAlpha = settings.position.opacity;
    
    if (settings.type === 'text' && settings.text) {
      const text = settings.text;
      if (!text || !text.content) return;
      
      // 设置字体
      const fontSize = Math.max(12, (text.font?.size || 24) * settings.position.scale);
      const fontFamily = text.font?.family || 'Arial, sans-serif';
      const fontWeight = text.font?.weight || 'normal';
      const fontStyle = text.font?.style || 'normal';
      
      context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      context.fillStyle = (typeof text.color === 'string' ? text.color : text.color?.primary) || '#000000';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      // 计算位置
      let x: number;
      let y: number;
      
      switch (settings.position.placement) {
        case 'center':
          x = canvas.width / 2;
          y = canvas.height / 2;
          break;
        case 'corner':
          const margin = 20;
          switch (settings.position.corner) {
            case 'top-left':
              x = margin;
              y = margin;
              context.textAlign = 'left';
              context.textBaseline = 'top';
              break;
            case 'top-right':
              x = canvas.width - margin;
              y = margin;
              context.textAlign = 'right';
              context.textBaseline = 'top';
              break;
            case 'bottom-left':
              x = margin;
              y = canvas.height - margin;
              context.textAlign = 'left';
              context.textBaseline = 'bottom';
              break;
            case 'bottom-right':
            default:
              x = canvas.width - margin;
              y = canvas.height - margin;
              context.textAlign = 'right';
              context.textBaseline = 'bottom';
              break;
          }
          break;
        default:
          x = canvas.width / 2;
          y = canvas.height / 2;
          break;
      }
      
      // 应用旋转
      if (settings.position.rotation) {
        context.translate(x, y);
        context.rotate((settings.position.rotation * Math.PI) / 180);
        x = 0;
        y = 0;
      }
      
      // 绘制文字（带阴影效果）
      context.shadowColor = 'rgba(255, 255, 255, 0.8)';
      context.shadowOffsetX = 1;
      context.shadowOffsetY = 1;
      context.shadowBlur = 2;
      
      context.fillText(text.content, x, y);
    }
    
    // 恢复状态
    context.restore();
  }

  /**
   * 获取文件类型
   */
  private getFileType(file: File): 'pdf' | 'word' | 'unknown' {
    if (file.type === 'application/pdf') {
      return 'pdf';
    }
    
    if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.name.toLowerCase().endsWith('.docx') ||
      file.name.toLowerCase().endsWith('.doc')
    ) {
      return 'word';
    }
    
    return 'unknown';
  }

  /**
   * Canvas转换为Blob
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement, 
    format: string, 
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas转换为Blob失败'));
          }
        },
        `image/${format}`,
        quality
      );
    });
  }
}