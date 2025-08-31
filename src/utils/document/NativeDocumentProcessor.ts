/**
 * 原生文档处理器 - 保持原始文档格式输出
 * 支持PDF和Word文档的水印添加，输出为相同格式
 */

import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import type { SimpleWatermarkSettings, SimpleColorConfig } from '../watermark/SimpleWatermarkProcessor';
import { ChineseFontLoader } from '../fonts/ChineseFontLoader';

export interface NativeDocumentResult {
  success: boolean;
  originalFile: File;
  processedDocument?: {
    blob: Blob;
    dataUrl: string;
    format: string;
    pageCount?: number;
    size: number;
  };
  error?: string;
  processingTime: number;
  metadata?: {
    method: string;
    fontUsed: string;
    chineseSupport: boolean;
    warning?: string;
    error?: string;
  };
}

export class NativeDocumentProcessor {
  
  /**
   * 处理文档文件，保持原始格式输出
   * 现在支持PDF中文水印
   */
  async processDocument(
    file: File, 
    settings: SimpleWatermarkSettings
  ): Promise<NativeDocumentResult> {
    console.log('🚀 开始原生文档处理:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    // 详细的用户设置调试日志
    console.log('🔧 完整用户设置参数:', {
      type: settings.type,
      text: {
        content: settings.text?.content,
        font: settings.text?.font,
        color: settings.text?.color
      },
      position: {
        placement: settings.position.placement,
        opacity: settings.position.opacity,
        scale: settings.position.scale,
        corner: settings.position.corner,
        edge: settings.position.edge,
        pattern: settings.position.pattern,
        margin: settings.position.margin
      },
      rawSettings: JSON.stringify(settings, null, 2)
    });
    
    const startTime = performance.now();

    try {
      const fileType = this.getFileType(file);
      
      if (fileType === 'pdf') {
        return await this.processPDFNative(file, settings, startTime);
      } else if (fileType === 'word') {
        return await this.processWordNative(file, settings, startTime);
      } else {
        throw new Error(`不支持的文档格式: ${file.type}`);
      }
    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('原生文档处理失败:', error);
      
      return {
        success: false,
        originalFile: file,
        error: error instanceof Error ? error.message : '未知错误',
        processingTime
      };
    }
  }

  /**
   * 处理PDF文档 - 使用pdf-lib直接操作PDF
   */
  private async processPDFNative(
    file: File,
    settings: SimpleWatermarkSettings,
    startTime: number
  ): Promise<NativeDocumentResult> {
    // 读取PDF文件
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // 获取页面信息
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;

    // 设置水印样式
    const watermarkText = settings.text?.content || 'WATERMARK';
    // 确保字体大小足够大，特别是对于小的PDF
    const baseFontSize = Math.max(24, (settings.text?.font?.size || 24));
    const fontSize = Math.max(18, baseFontSize * settings.position.scale);
    // 确保透明度不会让水印完全消失
    const opacity = Math.max(0.3, Math.min(1.0, settings.position.opacity));

    console.log('PDF水印参数:', {
      watermarkText,
      fontSize,
      opacity,
      scale: settings.position.scale,
      placement: settings.position.placement,
      corner: settings.position.corner,
      containsChinese: ChineseFontLoader.containsChineseCharacters(watermarkText)
    });

    // 创建支持中文的字体
    const font = await ChineseFontLoader.createPDFFont(pdfDoc, watermarkText) || undefined;

    // 解析颜色，使用用户设置的颜色或默认黑色
    const textColor = settings.text?.color;
    const colorString = typeof textColor === 'string' ? textColor : textColor?.primary || '#000000';
    const color = this.parseColor(colorString);

    // 在每页添加水印
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const { width, height } = page.getSize();
      
      console.log(`处理第${pageIndex + 1}页，尺寸: ${width} x ${height}`);
      
      // 计算水印位置列表
      const watermarkPositions = this.calculateWatermarkPositions(width, height, settings, fontSize);

      // 现在支持中文水印，不需要预处理
      const finalWatermarkText = watermarkText;
      
      // 确保水印文本不为空
      if (!finalWatermarkText || finalWatermarkText.trim() === '') {
        console.error('水印文本为空!', { watermarkText });
        continue; // 跳过这页
      }
      
      console.log(`页面${pageIndex + 1}水印详情:`, {
        text: finalWatermarkText,
        positionCount: watermarkPositions.length,
        fontSize,
        opacity,
        color: color,
        fontSupport: ChineseFontLoader.containsChineseCharacters(finalWatermarkText) ? '中文字体' : '标准字体'
      });
      
      // 根据用户设置在所有计算的位置添加水印
      for (let posIndex = 0; posIndex < watermarkPositions.length; posIndex++) {
        const { x, y } = watermarkPositions[posIndex];
        
        try {
          console.log(`在页面${pageIndex + 1}添加水印到位置 (${x}, ${y})`);
          
          page.drawText(finalWatermarkText, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
            opacity
          });

          console.log(`页面${pageIndex + 1}位置${posIndex + 1}水印添加成功`);

        } catch (drawError) {
          console.error(`绘制水印失败 (位置${posIndex + 1})，使用备用方案:`, drawError);
          
          // 备用方案：使用最安全的参数
          try {
            page.drawText(finalWatermarkText, {
              x: Math.max(50, Math.min(x, width - 150)),
              y: Math.max(50, Math.min(y, height - 50)),
              size: Math.max(16, fontSize),
              font,
              color: rgb(1, 0, 0), // 红色确保可见
              opacity: 1.0
            });
            console.log(`页面${pageIndex + 1}位置${posIndex + 1}使用备用方案添加水印成功`);
          } catch (backupError) {
            console.error(`备用方案也失败 (位置${posIndex + 1}):`, backupError);
          }
        }
      }

      console.log(`页面${pageIndex + 1}水印添加完成`);
    }

    // 生成处理后的PDF
    console.log('开始保存PDF文档...');
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false
    });
    
    console.log('PDF保存完成，字节数:', pdfBytes.length);
    
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const dataUrl = await this.blobToDataUrl(blob);
    
    console.log('PDF转换为DataURL完成，大小:', blob.size);

    const processingTime = performance.now() - startTime;

    return {
      success: true,
      originalFile: file,
      processedDocument: {
        blob,
        dataUrl,
        format: 'pdf',
        pageCount,
        size: blob.size
      },
      processingTime
    };
  }

  /**
   * 处理Word文档 - 使用JSZip读取和修改现有Word文档内容并添加水印
   */
  private async processWordNative(
    file: File,
    settings: SimpleWatermarkSettings,
    startTime: number
  ): Promise<NativeDocumentResult> {
    try {
      // 读取Word文件内容
      const arrayBuffer = await file.arrayBuffer();
      const watermarkText = settings.text?.content || 'WATERMARK';
      // const fontSize = Math.max(12, (settings.text?.font?.size || 24) * settings.position.scale);
      
      // 使用JSZip读取Word文档（DOCX是ZIP格式）
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // 检查是否存在关键的Word文档文件
      const documentXml = zip.file('word/document.xml');
      if (!documentXml) {
        throw new Error('不是有效的Word文档格式：缺少 word/document.xml');
      }

      // 读取原始文档内容
      const originalXmlContent = await documentXml.async('string');
      console.log('读取原始文档XML内容成功');

      // 解析并修改XML内容添加水印
      let modifiedXmlContent = this.addWatermarkToWordXML(
        originalXmlContent, 
        watermarkText, 
        settings
      );

      // 更新文档XML内容
      zip.file('word/document.xml', modifiedXmlContent);

      // 生成修改后的Word文档
      const modifiedArrayBuffer = await zip.generateAsync({
        type: 'arraybuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      });

      const blob = new Blob([modifiedArrayBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const dataUrl = await this.blobToDataUrl(blob);

      const processingTime = performance.now() - startTime;

      return {
        success: true,
        originalFile: file,
        processedDocument: {
          blob,
          dataUrl,
          format: 'docx',
          pageCount: 1, // Word文档页数需要进一步解析确定
          size: blob.size
        },
        processingTime
      };
    } catch (error) {
      console.error('Word文档处理失败:', error);
      
      const processingTime = performance.now() - startTime;
      return {
        success: false,
        originalFile: file,
        error: 'Word文档处理失败: ' + (error instanceof Error ? error.message : '未知错误'),
        processingTime
      };
    }
  }

  /**
   * 在Word文档XML中添加水印
   */
  private addWatermarkToWordXML(
    xmlContent: string, 
    watermarkText: string, 
    settings: SimpleWatermarkSettings
  ): string {
    try {
      // 解析XML内容，查找文档根元素
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
      
      // 检查解析是否成功
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.warn('XML解析失败，使用字符串替换方式:', parseError.textContent);
        return this.addWatermarkToWordXMLByString(xmlContent, watermarkText, settings);
      }

      // 查找文档主体元素
      const bodyElement = xmlDoc.querySelector('w\\:body, body');
      if (!bodyElement) {
        console.warn('未找到文档主体元素，使用字符串替换方式');
        return this.addWatermarkToWordXMLByString(xmlContent, watermarkText, settings);
      }

      // 创建水印段落元素
      const watermarkParagraph = this.createWatermarkParagraphXML(watermarkText, settings, xmlDoc as any);
      
      // 在文档开始处插入水印段落
      const firstChild = bodyElement.firstElementChild;
      if (firstChild) {
        bodyElement.insertBefore(watermarkParagraph, firstChild);
      } else {
        bodyElement.appendChild(watermarkParagraph);
      }

      // 将修改后的XML转换回字符串
      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
      
    } catch (error) {
      console.warn('DOM方式处理XML失败，使用字符串替换:', error);
      return this.addWatermarkToWordXMLByString(xmlContent, watermarkText, settings);
    }
  }

  /**
   * 使用字符串替换方式在Word XML中添加水印（备用方案）
   */
  private addWatermarkToWordXMLByString(
    xmlContent: string, 
    watermarkText: string, 
    settings: SimpleWatermarkSettings
  ): string {
    // 创建多个水印段落的XML字符串
    // const opacity = Math.round(settings.position.opacity * 100);
    const color = this.getColorHex(settings.text?.color) || '000000';
    const fontSize = Math.max(12, (settings.text?.font?.size || 24) * settings.position.scale * 2); // Word使用半点单位

    let watermarksXML = '';
    
    // 根据位置设置生成多个水印
    const watermarkCount = this.getWordWatermarkCount(settings);
    
    for (let i = 0; i < watermarkCount; i++) {
      const justification = this.getWordWatermarkJustification(settings, i);
      
      watermarksXML += `
      <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:pPr>
          <w:jc w:val="${justification}"/>
          <w:spacing w:after="120"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:sz w:val="${fontSize}"/>
            <w:szCs w:val="${fontSize}"/>
            <w:color w:val="${color}"/>
            <w:highlight w:val="none"/>
          </w:rPr>
          <w:t>${this.escapeXmlText(watermarkText)}</w:t>
        </w:r>
      </w:p>`;
      
      // 对于均匀分布，添加一些空行来分隔水印
      if (settings.position.placement === 'pattern' && i < watermarkCount - 1) {
        watermarksXML += `
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:pPr>
            <w:spacing w:after="360"/>
          </w:pPr>
        </w:p>`;
      }
    }

    // 查找文档体的开始标签并在其后插入水印
    const bodyStartMatch = xmlContent.match(/<w:body[^>]*>/);
    if (bodyStartMatch) {
      const insertPosition = bodyStartMatch.index! + bodyStartMatch[0].length;
      return xmlContent.slice(0, insertPosition) + 
             watermarksXML + 
             xmlContent.slice(insertPosition);
    }

    // 如果没找到标准的w:body，尝试查找其他可能的位置
    const documentMatch = xmlContent.match(/<w:document[^>]*>/);
    if (documentMatch) {
      const insertPosition = documentMatch.index! + documentMatch[0].length;
      return xmlContent.slice(0, insertPosition) + 
             `<w:body xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${watermarksXML}</w:body>` +
             xmlContent.slice(insertPosition);
    }

    console.warn('无法找到合适的插入位置，水印添加失败');
    return xmlContent;
  }

  /**
   * 获取Word文档中水印的数量
   */
  private getWordWatermarkCount(settings: SimpleWatermarkSettings): number {
    switch (settings.position.placement) {
      case 'pattern':
        return 6; // 在Word中添加6个水印来模拟均匀分布
      case 'corner':
      case 'center':
      case 'edge':
      default:
        return 1; // 单个水印
    }
  }

  /**
   * 获取Word文档中水印的对齐方式
   */
  private getWordWatermarkJustification(settings: SimpleWatermarkSettings, index: number): string {
    switch (settings.position.placement) {
      case 'center':
        return 'center';
      case 'corner':
        switch (settings.position.corner) {
          case 'top-left':
          case 'bottom-left':
            return 'left';
          case 'top-right':
          case 'bottom-right':
            return 'right';
          default:
            return 'right';
        }
      case 'edge':
        switch (settings.position.edge) {
          case 'left':
            return 'left';
          case 'right':
            return 'right';
          case 'top':
          case 'bottom':
            return 'center';
          default:
            return 'center';
        }
      case 'pattern':
        // 交替使用不同对齐方式来实现分布效果
        const alignments = ['left', 'center', 'right', 'left', 'center', 'right'];
        return alignments[index % alignments.length];
      default:
        return 'center';
    }
  }

  /**
   * 创建水印段落的DOM元素
   */
  private createWatermarkParagraphXML(
    watermarkText: string, 
    settings: SimpleWatermarkSettings,
    xmlDoc: XMLDocument
  ): Element {
    const nsUri = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    
    // 创建段落元素
    const paragraph = xmlDoc.createElementNS(nsUri, 'w:p');
    
    // 创建段落属性
    const paragraphProps = xmlDoc.createElementNS(nsUri, 'w:pPr');
    const justification = xmlDoc.createElementNS(nsUri, 'w:jc');
    justification.setAttribute('w:val', 'center');
    paragraphProps.appendChild(justification);
    
    const spacing = xmlDoc.createElementNS(nsUri, 'w:spacing');
    spacing.setAttribute('w:after', '240');
    paragraphProps.appendChild(spacing);
    
    paragraph.appendChild(paragraphProps);
    
    // 创建文本运行元素
    const run = xmlDoc.createElementNS(nsUri, 'w:r');
    
    // 创建文本运行属性
    const runProps = xmlDoc.createElementNS(nsUri, 'w:rPr');
    
    const fontSize = Math.max(12, (settings.text?.font?.size || 24) * settings.position.scale * 2);
    const sz = xmlDoc.createElementNS(nsUri, 'w:sz');
    sz.setAttribute('w:val', fontSize.toString());
    runProps.appendChild(sz);
    
    const szCs = xmlDoc.createElementNS(nsUri, 'w:szCs');
    szCs.setAttribute('w:val', fontSize.toString());
    runProps.appendChild(szCs);
    
    const color = xmlDoc.createElementNS(nsUri, 'w:color');
    color.setAttribute('w:val', this.getColorHex(settings.text?.color) || '000000');
    runProps.appendChild(color);
    
    run.appendChild(runProps);
    
    // 创建文本元素
    const text = xmlDoc.createElementNS(nsUri, 'w:t');
    text.textContent = watermarkText;
    run.appendChild(text);
    
    paragraph.appendChild(run);
    
    return paragraph;
  }

  /**
   * 转义XML文本内容
   */
  private escapeXmlText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 计算水印位置列表
   */
  private calculateWatermarkPositions(
    pageWidth: number, 
    pageHeight: number, 
    settings: SimpleWatermarkSettings, 
    fontSize: number
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const margin = 50;
    
    switch (settings.position.placement) {
      case 'center':
        positions.push({
          x: pageWidth / 2,
          y: pageHeight / 2
        });
        break;
        
      case 'corner':
        switch (settings.position.corner) {
          case 'top-left':
            positions.push({ x: margin, y: pageHeight - margin });
            break;
          case 'top-right':
            positions.push({ x: pageWidth - margin, y: pageHeight - margin });
            break;
          case 'bottom-left':
            positions.push({ x: margin, y: margin + fontSize });
            break;
          case 'bottom-right':
          default:
            positions.push({ x: pageWidth - margin, y: margin + fontSize });
            break;
        }
        break;
        
      case 'edge':
        const edgeMargin = 30;
        switch (settings.position.edge) {
          case 'top':
            positions.push({ x: pageWidth / 2, y: pageHeight - edgeMargin });
            break;
          case 'right':
            positions.push({ x: pageWidth - edgeMargin, y: pageHeight / 2 });
            break;
          case 'bottom':
            positions.push({ x: pageWidth / 2, y: edgeMargin + fontSize });
            break;
          case 'left':
            positions.push({ x: edgeMargin, y: pageHeight / 2 });
            break;
        }
        break;
        
      case 'pattern':
        // 均匀分布水印
        const spacingX = settings.position.pattern?.spacing?.x || 200;
        const spacingY = settings.position.pattern?.spacing?.y || 150;
        const offsetX = settings.position.pattern?.offset?.x || 0;
        const offsetY = settings.position.pattern?.offset?.y || 0;
        const stagger = settings.position.pattern?.stagger || false;
        
        // 计算可以放置的水印数量
        const cols = Math.floor((pageWidth - 2 * margin) / spacingX) + 1;
        const rows = Math.floor((pageHeight - 2 * margin - fontSize) / spacingY) + 1;
        
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            let x = margin + col * spacingX + offsetX;
            let y = margin + fontSize + row * spacingY + offsetY;
            
            // 交错排列：奇数行偏移
            if (stagger && row % 2 === 1) {
              x += spacingX / 2;
            }
            
            // 确保位置在页面范围内
            if (x >= margin && x <= pageWidth - margin && 
                y >= margin + fontSize && y <= pageHeight - margin) {
              positions.push({ x, y });
            }
          }
        }
        break;
        
      default:
        // 默认使用右下角
        positions.push({
          x: pageWidth - margin,
          y: margin + fontSize
        });
        break;
    }
    
    return positions;
  }


  /**
   * 将中文水印文本转换为ASCII兼容格式（保留兼容性）
   */
  // private convertToASCIIWatermark(text: string): string {
  //   return this.getASCIICompatibleText(text);
  // }

  /**
   * 处理Word文档转PDF（带水印）
   */
  async processWordToPDF(
    file: File,
    settings: SimpleWatermarkSettings
  ): Promise<NativeDocumentResult> {
    const startTime = performance.now();
    
    try {
      console.log('📄 开始Word转PDF处理流程...');
      
      // Word转PDF完整用户参数调试日志
      console.log('🔧 Word转PDF用户设置详情:', {
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)}KB`,
        watermarkType: settings.type,
        textSettings: {
          content: settings.text?.content,
          font: {
            family: settings.text?.font?.family || '默认',
            size: settings.text?.font?.size || 24,
            weight: settings.text?.font?.weight || 'normal',
            style: settings.text?.font?.style || 'normal'
          },
          color: settings.text?.color
        },
        positionSettings: {
          placement: settings.position.placement,
          opacity: settings.position.opacity,
          scale: settings.position.scale,
          corner: settings.position.corner,
          edge: settings.position.edge,
          margin: settings.position.margin,
          pattern: settings.position.pattern
        },
        chineseText: settings.text?.content ? 
          ChineseFontLoader.containsChineseCharacters(settings.text.content) : false,
        timestamp: new Date().toISOString()
      });
      
      // 原始设置的JSON打印（用于完整调试）
      console.log('🗂️ 原始设置JSON:', JSON.stringify(settings, null, 2));
      
      // Word转PDF现在支持中文字符
      
      // 首先尝试读取Word文档内容并提取文本
      const wordContent = await this.extractWordContent(file);
      console.log('Word内容提取完成:', wordContent.substring(0, 100) + '...');
      
      // 创建新的PDF文档
      const pdfLib = await import('pdf-lib');
      const { PDFDocument, rgb } = pdfLib;
      
      console.log('pdf-lib imported:', !!pdfLib);
      console.log('PDFDocument available:', !!PDFDocument);
      console.log('PDFDocument.create type:', typeof PDFDocument?.create);
      
      if (!PDFDocument || typeof PDFDocument.create !== 'function') {
        throw new Error('PDF-lib 库加载失败或版本不兼容');
      }
      
      const pdfDoc = await PDFDocument.create();
      console.log('PDF文档创建成功，addPage方法:', typeof pdfDoc.addPage);
      
      // 添加页面
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 尺寸
      const { width, height } = page.getSize();
      
      // 创建支持中文的字体（用于内容和水印）
      const watermarkText = settings.text?.content || 'WATERMARK';
      const font = await ChineseFontLoader.createPDFFont(pdfDoc, watermarkText + wordContent);
      
      // 如果无法加载中文字体，使用标准字体并记录警告
      if (!font) {
        console.warn('无法加载适合的字体，使用标准字体，中文可能显示不正确');
        const fallbackFont = await pdfDoc.embedFont('Helvetica');
        // 对于包含中文的文本，生成警告并尝试继续
        return this.processWordToPDFWithFallback(pdfDoc, wordContent, settings, fallbackFont, file, startTime);
      }
      
      // 添加原始文档内容 - 改进版，支持多页
      const contentLines = wordContent.split('\n').filter(line => line.trim());
      let yPosition = height - 50;
      const lineHeight = 20;
      const maxWidth = width - 100;
      const bottomMargin = 50;
      
      console.log('📄 Word内容处理详情:', {
        totalLines: contentLines.length,
        pageSize: { width, height },
        contentParameters: {
          lineHeight,
          maxWidth,
          topMargin: 50,
          bottomMargin,
          sideMargins: 100,
          expectedLinesPerPage: Math.floor((height - 100) / lineHeight) // 约37行每页
        },
        estimatedPages: Math.ceil(contentLines.length / Math.floor((height - 100) / lineHeight)),
        contentPreview: contentLines.slice(0, 3).join(' | '),
        fontSupport: '支持中文字体',
        processingMode: 'normal'
      });
      
      let currentPage = page;
      let processedLines = 0;
      
      for (const line of contentLines) {
        // 处理长文本换行
        const wrappedLines = this.wrapText(line, font, 12, maxWidth);
        
        for (const wrappedLine of wrappedLines) {
          // 如果当前页面空间不足，创建新页面
          if (yPosition < bottomMargin) {
            console.log(`📄 正常模式创建新页面，已处理 ${processedLines} 行内容，空间利用率: ${Math.round((processedLines * lineHeight / (height - 100)) * 100)}%`);
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            yPosition = height - 50;
          }
          
          try {
            currentPage.drawText(wrappedLine, {
              x: 50,
              y: yPosition,
              size: 12,
              font,
              color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight;
            processedLines++;
          } catch (drawError) {
            console.warn('绘制文本失败:', drawError, '行内容:', wrappedLine.substring(0, 50));
            yPosition -= lineHeight; // 跳过有问题的行但继续处理
          }
        }
      }
      
      console.log('📄 Word内容处理完成:', {
        processingMode: 'normal',
        totalPages: pdfDoc.getPageCount(),
        processedLines,
        lastPageYPosition: yPosition,
        pageUtilization: {
          lastPageUsage: Math.round(((height - yPosition) / (height - 100)) * 100) + '%',
          averageLinesPerPage: Math.round(processedLines / pdfDoc.getPageCount()),
          totalContentHeight: processedLines * lineHeight,
          spaceEfficiency: '正常模式，标准边距和行高'
        },
        contentProcessing: {
          fontSupport: 'Chinese font loaded successfully',
          encoding: 'UTF-8 compatible',
          textWrapping: 'Enabled for long lines'
        }
      });
      
      // 添加水印到所有页面 - 现在支持中文
      const finalWatermarkText = watermarkText; // 直接使用原始文本，支持中文
      const watermarkFontSize = Math.max(18, (settings.text?.font?.size || 24) * settings.position.scale);
      const watermarkOpacity = Math.max(0.3, Math.min(1.0, settings.position.opacity));
      const colorStr = typeof settings.text?.color === 'string' 
        ? settings.text.color 
        : settings.text?.color?.primary || '#000000';
      const watermarkColor = this.parseColor(colorStr);
      
      console.log('🎨 Word转PDF水印详细参数:', {
        text: finalWatermarkText,
        fontSize: watermarkFontSize,
        opacity: watermarkOpacity,
        color: {
          original: settings.text?.color,
          parsed: colorStr,
          rgb: watermarkColor
        },
        position: {
          placement: settings.position.placement,
          scale: settings.position.scale,
          opacity: settings.position.opacity
        },
        supportsChinese: ChineseFontLoader.containsChineseCharacters(finalWatermarkText)
      });
      
      // 获取所有页面并在每个页面添加水印
      const allPages = pdfDoc.getPages();
      console.log(`🎨 为 ${allPages.length} 个页面添加水印...`);
      
      for (let pageIndex = 0; pageIndex < allPages.length; pageIndex++) {
        const currentPageForWatermark = allPages[pageIndex];
        const { width: pageWidth, height: pageHeight } = currentPageForWatermark.getSize();
        
        // 计算每个页面的水印位置
        const watermarkPositions = this.calculateWatermarkPositions(pageWidth, pageHeight, settings, watermarkFontSize);
        
        console.log(`🎨 页面 ${pageIndex + 1} 水印位置数量:`, watermarkPositions.length);
        
        // 使用Canvas渲染中文水印 - 修复中文显示问题
        try {
          console.log(`🎨 页面 ${pageIndex + 1} 开始Canvas水印渲染...`);
          
          // 导入ChineseWatermarkRenderer
          const { ChineseWatermarkRenderer } = await import('../../engines/canvas/ChineseWatermarkRenderer');
          
          // 创建水印配置
          const watermarkOptions = {
            text: finalWatermarkText,
            fontSize: watermarkFontSize,
            color: colorStr,
            opacity: watermarkOpacity,
            rotation: 0 // Word转PDF通常不需要旋转
          };
          
          console.log(`🎨 Canvas水印配置:`, watermarkOptions);
          
          // 创建中文水印图像
          const watermarkImage = await ChineseWatermarkRenderer.createChineseWatermarkImage(watermarkOptions);
          
          console.log(`🎨 Canvas水印图像创建成功:`, {
            dimensions: watermarkImage.dimensions,
            blobSize: watermarkImage.blob.size
          });
          
          // 将水印PNG嵌入PDF
          const imageBytes = await this.blobToArrayBuffer(watermarkImage.blob);
          const pdfImage = await pdfDoc.embedPng(imageBytes);
          
          // 添加水印到所有位置
          for (let posIndex = 0; posIndex < watermarkPositions.length; posIndex++) {
            const { x, y } = watermarkPositions[posIndex];
            
            try {
              // 计算水印尺寸（适当缩放以适应网格布局）
              const scaleFactor = 0.8; // 稍微缩小以适应密集布局
              const imageWidth = watermarkImage.dimensions.width * scaleFactor;
              const imageHeight = watermarkImage.dimensions.height * scaleFactor;
              
              // 以指定位置为中心绘制水印
              currentPageForWatermark.drawImage(pdfImage, {
                x: x - imageWidth / 2,
                y: y - imageHeight / 2,
                width: imageWidth,
                height: imageHeight,
                opacity: watermarkOpacity * 0.9 // 稍微调整透明度
              });
              
              console.log(`✅ 页面 ${pageIndex + 1} 位置 ${posIndex + 1} Canvas水印添加成功`);
            } catch (drawError) {
              console.error(`❌ 页面 ${pageIndex + 1} 位置 ${posIndex + 1} Canvas水印添加失败:`, drawError);
            }
          }
          
        } catch (canvasError) {
          console.warn(`⚠️ Canvas水印渲染失败，使用传统方式:`, canvasError);
          
          // 回退到传统PDF文本绘制
          for (let posIndex = 0; posIndex < watermarkPositions.length; posIndex++) {
            const { x, y } = watermarkPositions[posIndex];
            
            try {
              currentPageForWatermark.drawText(finalWatermarkText, {
                x,
                y,
                size: watermarkFontSize,
                font,
                color: rgb(watermarkColor.r, watermarkColor.g, watermarkColor.b),
                opacity: watermarkOpacity
              });
              console.log(`✅ 页面 ${pageIndex + 1} 位置 ${posIndex + 1} 传统水印添加成功`);
            } catch (error) {
              console.error(`❌ 页面 ${pageIndex + 1} 位置 ${posIndex + 1} 传统水印添加失败:`, error);
            }
          }
        }
      }
      
      console.log('🎨 所有页面水印添加完成');
      
      // 生成PDF
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false
      });
      
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const dataUrl = await this.blobToDataUrl(blob);
      
      const processingTime = performance.now() - startTime;
      
      console.log('Word转PDF处理完成');
      
      return {
        success: true,
        originalFile: file,
        processedDocument: {
          blob,
          dataUrl,
          format: 'pdf',
          pageCount: pdfDoc.getPageCount(),
          size: blob.size
        },
        processingTime
      };
      
    } catch (error) {
      console.error('Word转PDF处理失败:', error);
      
      const processingTime = performance.now() - startTime;
      return {
        success: false,
        originalFile: file,
        error: 'Word转PDF处理失败: ' + (error instanceof Error ? error.message : '未知错误'),
        processingTime
      };
    }
  }

  /**
   * 提取Word文档文本内容
   */
  private async extractWordContent(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const JSZip = (window as any).JSZip || await import('jszip');
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const documentXml = zip.file('word/document.xml');
      if (!documentXml) {
        return '无法读取Word文档内容';
      }
      
      const xmlContent = await documentXml.async('string');
      
      // 简单的XML文本提取
      const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (!textMatches) {
        return '文档内容提取失败';
      }
      
      const extractedText = textMatches
        .map((match: string) => match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
        .filter((text: string) => text.trim())
        .join(' ');
      
      return extractedText || '(Word文档已转换为PDF格式)';
      
    } catch (error) {
      console.error('提取Word内容失败:', error);
      return '(原Word文档内容 - 转换为PDF格式)';
    }
  }

  /**
   * 文本换行处理
   */
  private wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      let textWidth: number;
      
      try {
        textWidth = font.widthOfTextAtSize(testLine, fontSize);
      } catch (encodingError) {
        // 如果字体编码失败（如中文字符用非中文字体），使用估算宽度
        console.warn('字体编码失败，使用估算宽度:', encodingError);
        textWidth = this.estimateTextWidth(testLine, fontSize);
      }
      
      if (textWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  /**
   * 估算文本宽度（用于字体编码失败时的回退方案）
   */
  private estimateTextWidth(text: string, fontSize: number): number {
    // 对于中文字符，使用固定宽度估算
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
    const chineseChars = (text.match(chineseRegex) || []).length;
    const otherChars = text.length - chineseChars;
    
    // 中文字符约为字体大小的1倍宽度，英文字符约为0.6倍
    return (chineseChars * fontSize * 1.0) + (otherChars * fontSize * 0.6);
  }

  /**
   * 使用回退字体处理Word转PDF（当中文字体加载失败时）
   */
  private async processWordToPDFWithFallback(
    pdfDoc: any, 
    wordContent: string, 
    settings: SimpleWatermarkSettings, 
    fallbackFont: any,
    originalFile: File,
    startTime: number
  ): Promise<NativeDocumentResult> {
    try {
      console.log('⚠️ 进入Word转PDF回退模式');
      console.log('🔄 回退模式用户参数:', {
        fileName: originalFile.name,
        watermarkText: settings.text?.content,
        fallbackFont: 'Helvetica',
        chineseContent: settings.text?.content ? 
          ChineseFontLoader.containsChineseCharacters(settings.text.content) : false,
        settingsSnapshot: {
          opacity: settings.position.opacity,
          scale: settings.position.scale,
          placement: settings.position.placement,
          color: settings.text?.color
        }
      });
      
      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();
      
      // 过滤掉包含中文的内容行，避免编码错误
      const contentLines = wordContent.split('\n')
        .filter(line => line.trim())
        .map(line => {
          // 如果包含中文，替换为提示信息
          if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(line)) {
            return '[Chinese text - font not available]';
          }
          return line;
        });
      
      let yPosition = height - 40; // 优化：减少顶部边距
      const lineHeight = 18; // 优化：减少行高以容纳更多内容
      const maxWidth = width - 80; // 优化：减少左右边距以利用更多空间
      const bottomMargin = 40; // 优化：减少底部边距
      
      // 添加内容（只处理非中文部分）- 改进版，支持多页和优化空间利用率
      console.log('🔄 Fallback模式处理内容详情:', {
        totalLines: contentLines.length,
        pageSize: { width, height },
        hasChineseReplacement: contentLines.some(line => line.includes('[Chinese text - font not available]')),
        optimizations: {
          topMargin: 40, // 从50减少到40
          lineHeight: 18, // 从20减少到18
          sideMargins: 80, // 从100减少到80
          bottomMargin: 40, // 从50减少到40
          expectedLinesPerPage: Math.floor((height - 80) / 18) // 约41行每页
        },
        estimatedPages: Math.ceil(contentLines.length / Math.floor((height - 80) / 18))
      });
      
      let currentPage = page;
      let processedLines = 0;
      
      for (const line of contentLines) {
        try {
          const wrappedLines = this.wrapText(line, fallbackFont, 12, maxWidth);
          
          for (const wrappedLine of wrappedLines) {
            // 如果当前页面空间不足，创建新页面
            if (yPosition < bottomMargin) {
              console.log(`🔄 Fallback模式创建新页面，已处理 ${processedLines} 行内容`);
              currentPage = pdfDoc.addPage([595.28, 841.89]);
              yPosition = height - 40; // 与优化后的顶部边距保持一致
            }
            
            currentPage.drawText(wrappedLine, {
              x: 40, // 优化：减少左边距以利用更多空间
              y: yPosition,
              size: 12,
              font: fallbackFont,
              color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight;
            processedLines++;
          }
        } catch (drawError) {
          console.warn('🔄 Fallback模式绘制文本失败:', drawError, '行内容:', line.substring(0, 50));
          yPosition -= lineHeight; // 跳过有问题的行但继续处理
        }
      }
      
      console.log('🔄 Fallback模式内容处理完成:', {
        processingMode: 'fallback',
        totalPages: pdfDoc.getPageCount(),
        processedLines,
        lastPageYPosition: yPosition,
        pageUtilization: {
          lastPageUsage: Math.round(((height - yPosition) / (height - 80)) * 100) + '%',
          averageLinesPerPage: Math.round(processedLines / pdfDoc.getPageCount()),
          totalContentHeight: processedLines * 18, // optimized lineHeight
          spaceEfficiency: 'Fallback模式，优化边距和行高提升30%空间利用率'
        },
        optimizations: {
          marginReduction: '边距从50减少到40',
          lineHeightOptimization: '行高从20减少到18',
          sideMarginReduction: '左右边距从100减少到80',
          spaceGain: '约30%更多内容空间'
        },
        contentProcessing: {
          fontSupport: 'Standard font (Chinese font failed to load)',
          encoding: 'ASCII compatible with Chinese text replacement',
          textWrapping: 'Enabled for long lines with optimized width'
        }
      });
      
      // 添加水印到所有页面（Fallback模式）
      const allPages = pdfDoc.getPages();
      console.log(`🔄 Fallback模式为 ${allPages.length} 个页面添加水印...`);
      
      const watermarkText = settings.text?.content && !ChineseFontLoader.containsChineseCharacters(settings.text.content) 
        ? settings.text.content 
        : 'WATERMARK'; // 中文水印使用英文替代
      
      console.log('🔄 Fallback模式水印参数:', {
        text: watermarkText,
        originalText: settings.text?.content,
        isChinese: settings.text?.content ? ChineseFontLoader.containsChineseCharacters(settings.text.content) : false,
        totalPages: allPages.length
      });
      
      for (let pageIndex = 0; pageIndex < allPages.length; pageIndex++) {
        try {
          const currentPageForWatermark = allPages[pageIndex];
          this.addTextWatermark(currentPageForWatermark, watermarkText, settings, fallbackFont);
          console.log(`✅ Fallback模式页面 ${pageIndex + 1} 水印添加成功`);
        } catch (watermarkError) {
          console.warn(`❌ Fallback模式页面 ${pageIndex + 1} 水印添加失败:`, watermarkError);
        }
      }
      
      console.log('🔄 Fallback模式所有页面水印添加完成');
      
      const pdfData = await pdfDoc.save();
      const processingTime = performance.now() - startTime;
      
      // 创建处理结果
      const processedBlob = new Blob([pdfData], { type: 'application/pdf' });
      const dataUrl = URL.createObjectURL(processedBlob);
      
      return {
        success: true,
        originalFile,
        processedDocument: {
          blob: processedBlob,
          dataUrl,
          format: 'pdf',
          pageCount: 1,
          size: pdfData.length
        },
        processingTime,
        metadata: {
          method: 'fallback',
          fontUsed: 'Helvetica (fallback)',
          chineseSupport: false,
          warning: '中文字体加载失败，使用回退方案'
        }
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('回退方案处理失败:', error);
      
      return {
        success: false,
        originalFile,
        processingTime,
        error: `回退PDF生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        metadata: {
          method: 'fallback',
          fontUsed: 'none',
          chineseSupport: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      };
    }
  }

  /**
   * 添加文本水印到PDF页面
   */
  private addTextWatermark(page: any, watermarkText: string, settings: SimpleWatermarkSettings, font: any): void {
    try {
      const { width, height } = page.getSize();
      
      // 从用户设置中获取参数，提供合理的默认值
      const fontSize = Math.max(18, (settings.text?.font?.size || 24) * settings.position.scale);
      const opacity = Math.max(0.1, Math.min(1.0, settings.position.opacity));
      
      // 解析用户设置的颜色
      const colorStr = typeof settings.text?.color === 'string' 
        ? settings.text.color 
        : settings.text?.color?.primary || '#666666';
      const colorRGB = this.parseColor(colorStr);
      
      // 完整的调试信息
      console.log('📝 PDF水印详细参数:', {
        text: watermarkText,
        fontSize: fontSize,
        opacity: opacity,
        color: {
          original: settings.text?.color,
          parsed: colorStr,
          rgb: colorRGB
        },
        position: {
          placement: settings.position.placement,
          scale: settings.position.scale,
          opacity: settings.position.opacity
        },
        font: {
          family: settings.text?.font?.family,
          size: settings.text?.font?.size,
          weight: settings.text?.font?.weight
        },
        pageSize: { width, height }
      });
      
      // 计算水印位置 - 居中
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
      const x = (width - textWidth) / 2;
      const y = height / 2;
      
      // 绘制水印文本
      page.drawText(watermarkText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(colorRGB.r, colorRGB.g, colorRGB.b),
        opacity,
        rotate: -45 // 45度倾斜
      });
      
    } catch (error) {
      console.warn('水印绘制过程中出错:', error);
      // 如果出错，尝试简单绘制
      try {
        page.drawText(watermarkText || 'WATERMARK', {
          x: 100,
          y: 400,
          size: 36,
          font,
          color: rgb(0.8, 0.8, 0.8)
        });
      } catch (simpleError) {
        console.warn('简单水印绘制也失败:', simpleError);
      }
    }
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
   * 获取颜色的十六进制值（不带#）
   */
  private getColorHex(color: string | SimpleColorConfig | undefined): string | undefined {
    if (!color) return undefined;
    
    if (typeof color === 'string') {
      return color.replace('#', '');
    }
    
    if (typeof color === 'object' && color.primary) {
      return color.primary.replace('#', '');
    }
    
    return undefined;
  }

  /**
   * 解析颜色字符串为RGB值
   */
  private parseColor(colorStr: string): { r: number; g: number; b: number } {
    try {
      if (!colorStr || typeof colorStr !== 'string') {
        console.warn('无效的颜色值，使用默认黑色:', colorStr);
        return { r: 0, g: 0, b: 0 };
      }
      
      // 移除#号
      const hex = colorStr.replace('#', '');
      
      // 验证十六进制颜色格式
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        console.warn('无效的十六进制颜色格式，使用默认黑色:', colorStr);
        return { r: 0, g: 0, b: 0 };
      }
      
      // 解析RGB
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      
      return { r, g, b };
      
    } catch (error) {
      console.warn('解析颜色时出错，使用默认黑色:', error);
      return { r: 0, g: 0, b: 0 };
    }
  }

  /**
   * Blob转DataUrl
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Blob转ArrayBuffer - 用于Canvas水印图像处理
   */
  private blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }
}