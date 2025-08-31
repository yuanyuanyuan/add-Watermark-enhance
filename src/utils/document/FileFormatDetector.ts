/**
 * 文件格式智能识别器
 * 基于用户提供的技术方案：通过文件头签名识别真实文件格式
 * 避免扩展名误导，提高文档处理的准确性
 */

export interface FileSignature {
  format: string;
  signature: number[];
  description: string;
  extension: string;
  mimeType: string;
}

export interface DetectionResult {
  detectedFormat: string;
  confidence: number;
  signature: string;
  isRealFormat: boolean;
  extensionMatch: boolean;
  mimeTypeMatch: boolean;
  supportedOperations: string[];
  warnings?: string[];
}

export class FileFormatDetector {
  /**
   * 支持的文件格式签名数据库
   */
  private static readonly FILE_SIGNATURES: FileSignature[] = [
    // Office文档格式
    {
      format: 'docx',
      signature: [0x50, 0x4B], // PK (ZIP格式)
      description: 'Microsoft Word 2007+ Document (OOXML)',
      extension: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    {
      format: 'xlsx',
      signature: [0x50, 0x4B], // PK (ZIP格式)
      description: 'Microsoft Excel 2007+ Spreadsheet (OOXML)',
      extension: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    {
      format: 'pptx',
      signature: [0x50, 0x4B], // PK (ZIP格式)
      description: 'Microsoft PowerPoint 2007+ Presentation (OOXML)',
      extension: 'pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    },
    {
      format: 'doc',
      signature: [0xD0, 0xCF, 0x11, 0xE0], // OLE2格式
      description: 'Microsoft Word 97-2003 Document (OLE2)',
      extension: 'doc',
      mimeType: 'application/msword'
    },
    {
      format: 'xls',
      signature: [0xD0, 0xCF, 0x11, 0xE0], // OLE2格式
      description: 'Microsoft Excel 97-2003 Spreadsheet (OLE2)',
      extension: 'xls',
      mimeType: 'application/vnd.ms-excel'
    },
    {
      format: 'ppt',
      signature: [0xD0, 0xCF, 0x11, 0xE0], // OLE2格式
      description: 'Microsoft PowerPoint 97-2003 Presentation (OLE2)',
      extension: 'ppt',
      mimeType: 'application/vnd.ms-powerpoint'
    },
    // PDF格式
    {
      format: 'pdf',
      signature: [0x25, 0x50, 0x44, 0x46], // %PDF
      description: 'Portable Document Format',
      extension: 'pdf',
      mimeType: 'application/pdf'
    },
    // 图像格式
    {
      format: 'png',
      signature: [0x89, 0x50, 0x4E, 0x47], // PNG
      description: 'Portable Network Graphics',
      extension: 'png',
      mimeType: 'image/png'
    },
    {
      format: 'jpeg',
      signature: [0xFF, 0xD8, 0xFF], // JPEG
      description: 'JPEG Image',
      extension: 'jpg',
      mimeType: 'image/jpeg'
    },
    {
      format: 'gif',
      signature: [0x47, 0x49, 0x46, 0x38], // GIF8
      description: 'Graphics Interchange Format',
      extension: 'gif',
      mimeType: 'image/gif'
    },
    {
      format: 'webp',
      signature: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP)
      description: 'WebP Image Format',
      extension: 'webp',
      mimeType: 'image/webp'
    },
    // 压缩格式
    {
      format: 'zip',
      signature: [0x50, 0x4B, 0x03, 0x04], // ZIP
      description: 'ZIP Archive',
      extension: 'zip',
      mimeType: 'application/zip'
    },
    {
      format: 'rar',
      signature: [0x52, 0x61, 0x72, 0x21], // Rar!
      description: 'RAR Archive',
      extension: 'rar',
      mimeType: 'application/vnd.rar'
    },
    {
      format: '7z',
      signature: [0x37, 0x7A, 0xBC, 0xAF], // 7z
      description: '7-Zip Archive',
      extension: '7z',
      mimeType: 'application/x-7z-compressed'
    },
    // 文本格式
    {
      format: 'rtf',
      signature: [0x7B, 0x5C, 0x72, 0x74, 0x66], // {\rtf
      description: 'Rich Text Format',
      extension: 'rtf',
      mimeType: 'application/rtf'
    }
  ];

  /**
   * 检测文件格式
   */
  static detectFileFormat(
    file: File | ArrayBuffer,
    fileName?: string,
    mimeType?: string
  ): DetectionResult {
    let arrayBuffer: ArrayBuffer;
    let actualFileName: string;
    let actualMimeType: string;

    if (file instanceof File) {
      // 由于无法同步读取File内容，这里需要异步版本
      throw new Error('请使用 detectFileFormatAsync 处理 File 对象');
    } else {
      arrayBuffer = file;
      actualFileName = fileName || 'unknown';
      actualMimeType = mimeType || 'application/octet-stream';
    }

    return this.detectFromArrayBuffer(arrayBuffer, actualFileName, actualMimeType);
  }

  /**
   * 异步检测文件格式
   */
  static async detectFileFormatAsync(file: File): Promise<DetectionResult> {
    const arrayBuffer = await this.fileToArrayBuffer(file);
    return this.detectFromArrayBuffer(arrayBuffer, file.name, file.type);
  }

  /**
   * 从ArrayBuffer检测格式
   */
  private static detectFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    fileName: string,
    mimeType: string
  ): DetectionResult {
    const uint8Array = new Uint8Array(arrayBuffer);
    const headerBytes = Array.from(uint8Array.slice(0, 16)); // 读取前16字节
    const signatureHex = headerBytes.map(byte => 
      byte.toString(16).padStart(2, '0').toUpperCase()
    ).join(' ');

    console.log('🔍 文件格式检测开始:', {
      fileName,
      fileSize: arrayBuffer.byteLength,
      mimeType,
      signature: signatureHex,
      headerBytes: headerBytes.slice(0, 8)
    });

    let bestMatch: {
      signature: FileSignature;
      confidence: number;
      matchLength: number;
    } | null = null;

    // 检查每个已知的文件签名
    for (const fileSignature of this.FILE_SIGNATURES) {
      const matchLength = this.compareSignature(headerBytes, fileSignature.signature);
      
      if (matchLength > 0) {
        const confidence = matchLength / fileSignature.signature.length;
        
        if (!bestMatch || confidence > bestMatch.confidence || 
            (confidence === bestMatch.confidence && matchLength > bestMatch.matchLength)) {
          bestMatch = {
            signature: fileSignature,
            confidence,
            matchLength
          };
        }
      }
    }

    // 分析文件扩展名和MIME类型
    const fileExtension = fileName.toLowerCase().split('.').pop() || '';
    const detectedFormat = bestMatch?.signature.format || 'unknown';
    const extensionMatch = bestMatch?.signature.extension === fileExtension;
    const mimeTypeMatch = bestMatch?.signature.mimeType === mimeType;

    // 特殊处理：OOXML格式需要进一步区分
    if (bestMatch && bestMatch.signature.format === 'docx' && 
        headerBytes[0] === 0x50 && headerBytes[1] === 0x4B) {
      const specificFormat = this.detectOOXMLFormat(arrayBuffer, fileExtension);
      if (specificFormat !== 'unknown') {
        const ooxml = this.FILE_SIGNATURES.find(sig => sig.format === specificFormat);
        if (ooxml) {
          bestMatch.signature = ooxml;
        }
      }
    }

    const warnings: string[] = [];
    
    if (!extensionMatch && bestMatch) {
      warnings.push(`文件扩展名 (.${fileExtension}) 与检测格式 (${detectedFormat}) 不匹配`);
    }
    
    if (!mimeTypeMatch && bestMatch) {
      warnings.push(`MIME类型 (${mimeType}) 与检测格式不匹配`);
    }

    if (arrayBuffer.byteLength < 16) {
      warnings.push('文件过小，可能影响格式检测准确性');
    }

    const supportedOperations = this.getSupportedOperations(detectedFormat);

    const result: DetectionResult = {
      detectedFormat,
      confidence: bestMatch?.confidence || 0,
      signature: signatureHex,
      isRealFormat: bestMatch !== null,
      extensionMatch,
      mimeTypeMatch,
      supportedOperations,
      warnings: warnings.length > 0 ? warnings : undefined
    };

    console.log('🎯 文件格式检测结果:', {
      ...result,
      matchedSignature: bestMatch?.signature,
      fileName,
      fileSize: arrayBuffer.byteLength
    });

    return result;
  }

  /**
   * 比较文件签名
   */
  private static compareSignature(headerBytes: number[], signature: number[]): number {
    let matchCount = 0;
    
    for (let i = 0; i < signature.length && i < headerBytes.length; i++) {
      if (headerBytes[i] === signature[i]) {
        matchCount++;
      } else {
        break;
      }
    }
    
    return matchCount;
  }

  /**
   * 检测OOXML格式的具体类型
   */
  private static detectOOXMLFormat(_arrayBuffer: ArrayBuffer, extension: string): string {
    try {
      // 这里可以进一步检查ZIP内容来确定具体的OOXML类型
      // 简化处理：基于文件扩展名
      switch (extension) {
        case 'docx':
          return 'docx';
        case 'xlsx':
          return 'xlsx';
        case 'pptx':
          return 'pptx';
        default:
          return 'docx'; // 默认假设为Word文档
      }
    } catch (error) {
      console.warn('OOXML格式检测失败:', error);
      return 'unknown';
    }
  }

  /**
   * 获取格式支持的操作
   */
  private static getSupportedOperations(format: string): string[] {
    const operations: Record<string, string[]> = {
      'docx': ['extract_text', 'add_watermark', 'convert_to_pdf'],
      'doc': ['extract_text', 'add_watermark', 'convert_to_pdf'],
      'pdf': ['add_watermark', 'extract_text', 'merge', 'split'],
      'xlsx': ['extract_data', 'add_watermark', 'convert_to_pdf'],
      'xls': ['extract_data', 'add_watermark', 'convert_to_pdf'],
      'png': ['add_watermark', 'resize', 'convert_format'],
      'jpeg': ['add_watermark', 'resize', 'convert_format'],
      'gif': ['add_watermark', 'resize', 'convert_format'],
      'webp': ['add_watermark', 'resize', 'convert_format'],
      'rtf': ['extract_text', 'convert_to_pdf'],
      'zip': ['extract', 'list_contents'],
      'rar': ['extract', 'list_contents'],
      '7z': ['extract', 'list_contents']
    };

    return operations[format] || ['unknown'];
  }

  /**
   * 批量检测多个文件格式
   */
  static async detectMultipleFiles(files: File[]): Promise<Map<string, DetectionResult>> {
    const results = new Map<string, DetectionResult>();
    
    const promises = files.map(async file => {
      try {
        const result = await this.detectFileFormatAsync(file);
        results.set(file.name, result);
      } catch (error) {
        console.error(`检测文件 ${file.name} 格式失败:`, error);
        results.set(file.name, {
          detectedFormat: 'unknown',
          confidence: 0,
          signature: 'error',
          isRealFormat: false,
          extensionMatch: false,
          mimeTypeMatch: false,
          supportedOperations: [],
          warnings: [`检测失败: ${error instanceof Error ? error.message : '未知错误'}`]
        });
      }
    });

    await Promise.all(promises);
    
    console.log('📊 批量检测完成:', {
      totalFiles: files.length,
      successCount: Array.from(results.values()).filter(r => r.detectedFormat !== 'unknown').length,
      errorCount: Array.from(results.values()).filter(r => r.warnings?.some(w => w.includes('检测失败'))).length
    });

    return results;
  }

  /**
   * 验证文件格式是否符合预期
   */
  static async validateFileFormat(
    file: File,
    expectedFormat: string
  ): Promise<{ isValid: boolean; actualFormat: string; confidence: number; issues?: string[] }> {
    const detection = await this.detectFileFormatAsync(file);
    const isValid = detection.detectedFormat === expectedFormat;
    
    const issues: string[] = [];
    
    if (!isValid) {
      issues.push(`预期格式 ${expectedFormat}，实际检测为 ${detection.detectedFormat}`);
    }
    
    if (detection.confidence < 0.8) {
      issues.push(`检测置信度较低 (${Math.round(detection.confidence * 100)}%)`);
    }
    
    if (detection.warnings) {
      issues.push(...detection.warnings);
    }

    return {
      isValid,
      actualFormat: detection.detectedFormat,
      confidence: detection.confidence,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  /**
   * 获取支持的文件格式列表
   */
  static getSupportedFormats(): FileSignature[] {
    return [...this.FILE_SIGNATURES];
  }

  /**
   * File转ArrayBuffer
   */
  private static fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 获取格式的详细信息
   */
  static getFormatInfo(format: string): FileSignature | undefined {
    return this.FILE_SIGNATURES.find(sig => sig.format === format);
  }

  /**
   * 检查是否为Office文档格式
   */
  static isOfficeDocument(format: string): boolean {
    return ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(format);
  }

  /**
   * 检查是否为图像格式
   */
  static isImageFormat(format: string): boolean {
    return ['png', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(format);
  }

  /**
   * 检查是否为压缩格式
   */
  static isArchiveFormat(format: string): boolean {
    return ['zip', 'rar', '7z', 'tar', 'gz'].includes(format);
  }
}