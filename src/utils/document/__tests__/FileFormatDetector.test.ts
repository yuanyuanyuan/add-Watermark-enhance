/**
 * 文件格式检测测试 - 单元测试
 * 测试用例覆盖：DOC-001~020
 * 包含：PDF/DOCX/DOC文件签名识别、伪造检测、损坏文件处理
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileFormatDetector } from '../FileFormatDetector';

// 模拟文件签名数据
const createMockFile = (signature: number[], name: string, type: string = 'application/octet-stream') => {
  const arrayBuffer = new ArrayBuffer(signature.length + 100);
  const view = new Uint8Array(arrayBuffer);
  signature.forEach((byte, index) => {
    view[index] = byte;
  });
  
  return new File([arrayBuffer], name, { type }) as File;
};

describe('FileFormatDetector - 文件格式检测测试', () => {
  beforeEach(() => {
    // 重置任何静态状态
  });

  describe('A. 文件格式检测 (18用例)', () => {
    it('DOC-001: PDF文件签名识别', async () => {
      // PDF文件签名: %PDF-
      const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2D];
      const pdfFile = createMockFile(pdfSignature, 'test.pdf', 'application/pdf');
      
      const result = await FileFormatDetector.detectFileFormat(pdfFile);
      
      expect(result.format).toBe('pdf');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.detectionMethod).toBe('signature');
    });

    it('DOC-002: DOCX文件签名识别', async () => {
      // DOCX文件签名: PK (ZIP format) + specific content
      const docxSignature = [0x50, 0x4B, 0x03, 0x04];
      const docxFile = createMockFile(docxSignature, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      const result = await FileFormatDetector.detectFileFormat(docxFile);
      
      expect(result.format).toBe('docx');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.mimeType).toContain('wordprocessingml');
      expect(result.supportedOperations).toContain('text-extraction');
    });

    it('DOC-003: DOC文件签名识别', async () => {
      // DOC文件签名: D0CF11E0A1B11AE1 (OLE2 format)
      const docSignature = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
      const docFile = createMockFile(docSignature, 'test.doc', 'application/msword');
      
      const result = await FileFormatDetector.detectFileFormat(docFile);
      
      expect(result.format).toBe('doc');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.mimeType).toBe('application/msword');
      expect(result.legacy).toBe(true);
    });

    it('DOC-004: 伪造扩展名检测', async () => {
      // 创建一个PDF文件但扩展名是.docx
      const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2D];
      const fakeFile = createMockFile(pdfSignature, 'fake.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      const result = await FileFormatDetector.detectFileFormat(fakeFile);
      
      expect(result.format).toBe('pdf'); // 应该检测出真实格式
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.extensionMatch).toBe(false);
      expect(result.warnings).toContain('文件扩展名与实际格式不匹配');
    });

    it('DOC-005: 损坏文件格式检测', async () => {
      // 创建损坏的文件（不完整的签名）
      const corruptedSignature = [0x25, 0x50]; // 不完整的PDF签名
      const corruptedFile = createMockFile(corruptedSignature, 'corrupted.pdf', 'application/pdf');
      
      const result = await FileFormatDetector.detectFileFormat(corruptedFile);
      
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.warnings).toContain('文件可能已损坏或不完整');
      expect(result.format).toBe('unknown');
    });

    it('DOC-006: 空文件处理', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      
      const result = await FileFormatDetector.detectFileFormat(emptyFile);
      
      expect(result.format).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.errors).toContain('文件为空');
      expect(result.size).toBe(0);
    });

    it('DOC-007: 大文件格式检测', async () => {
      // 创建大文件（只需要检查前几个字节）
      const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2D];
      const largeBuffer = new ArrayBuffer(10 * 1024 * 1024); // 10MB
      const view = new Uint8Array(largeBuffer);
      pdfSignature.forEach((byte, index) => {
        view[index] = byte;
      });
      
      const largeFile = new File([largeBuffer], 'large.pdf', { type: 'application/pdf' });
      
      const result = await FileFormatDetector.detectFileFormat(largeFile);
      
      expect(result.format).toBe('pdf');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.size).toBe(10 * 1024 * 1024);
      expect(result.optimizations).toContain('partial-read');
    });

    it('DOC-008: OOXML子格式区分', async () => {
      // DOCX和XLSX都是ZIP格式，需要通过内容区分
      const ooxmlSignature = [0x50, 0x4B, 0x03, 0x04];
      
      const docxFile = createMockFile(ooxmlSignature, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const xlsxFile = createMockFile(ooxmlSignature, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      const docxResult = await FileFormatDetector.detectFileFormat(docxFile);
      const xlsxResult = await FileFormatDetector.detectFileFormat(xlsxFile);
      
      expect(docxResult.format).toBe('docx');
      expect(xlsxResult.format).toBe('xlsx');
      expect(docxResult.detectionMethod).toBe('content-analysis');
    });

    it('DOC-009: 批量文件格式检测', async () => {
      const files = [
        createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D], 'file1.pdf', 'application/pdf'),
        createMockFile([0x50, 0x4B, 0x03, 0x04], 'file2.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        createMockFile([0xD0, 0xCF, 0x11, 0xE0], 'file3.doc', 'application/msword')
      ];
      
      const results = await Promise.all(files.map(f => FileFormatDetector.detectFileFormat(f)));
      
      expect(results).toHaveLength(3);
      expect(results[0].format).toBe('pdf');
      expect(results[1].format).toBe('docx');
      expect(results[2].format).toBe('doc');
      
      // 验证批量处理性能
      expect(results[0].processingTime).toBeDefined();
      expect(results.every(r => r.processingTime! < 100)).toBe(true); // 每个文件检测应该很快
    });

    it('DOC-010: 格式检测置信度计算', async () => {
      // 测试不同匹配程度的置信度
      const perfectMatch = createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37], 'test.pdf', 'application/pdf');
      const partialMatch = createMockFile([0x25, 0x50, 0x44, 0x46], 'test.pdf', 'application/pdf');
      const extensionOnly = createMockFile([0x00, 0x00, 0x00, 0x00], 'test.pdf', 'application/pdf');
      
      const perfect = await FileFormatDetector.detectFileFormat(perfectMatch);
      const partial = await FileFormatDetector.detectFileFormat(partialMatch);
      const extension = await FileFormatDetector.detectFileFormat(extensionOnly);
      
      expect(perfect.confidence).toBeGreaterThan(partial.confidence);
      expect(partial.confidence).toBeGreaterThan(extension.confidence);
      expect(perfect.confidence).toBeGreaterThan(0.9);
      expect(extension.confidence).toBeLessThan(0.5);
    });

    it('DOC-011: 未知格式处理', async () => {
      const unknownSignature = [0xFF, 0xFE, 0xFD, 0xFC];
      const unknownFile = createMockFile(unknownSignature, 'unknown.xyz', 'application/octet-stream');
      
      const result = await FileFormatDetector.detectFileFormat(unknownFile);
      
      expect(result.format).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.supportedOperations).toHaveLength(0);
      expect(result.recommendations).toContain('请确认文件格式或联系技术支持');
    });

    it('DOC-012: 压缩文件格式识别', async () => {
      const zipSignature = [0x50, 0x4B, 0x03, 0x04];
      const rarSignature = [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00];
      
      const zipFile = createMockFile(zipSignature, 'archive.zip', 'application/zip');
      const rarFile = createMockFile(rarSignature, 'archive.rar', 'application/x-rar-compressed');
      
      const zipResult = await FileFormatDetector.detectFileFormat(zipFile);
      const rarResult = await FileFormatDetector.detectFileFormat(rarFile);
      
      expect(zipResult.format).toBe('zip');
      expect(rarResult.format).toBe('rar');
      expect(zipResult.supportedOperations).toContain('archive-extraction');
      expect(rarResult.supportedOperations).toContain('archive-extraction');
    });

    it('DOC-013: 图片格式识别', async () => {
      const jpegSignature = [0xFF, 0xD8, 0xFF];
      const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      
      const jpegFile = createMockFile(jpegSignature, 'image.jpg', 'image/jpeg');
      const pngFile = createMockFile(pngSignature, 'image.png', 'image/png');
      
      const jpegResult = await FileFormatDetector.detectFileFormat(jpegFile);
      const pngResult = await FileFormatDetector.detectFileFormat(pngFile);
      
      expect(jpegResult.format).toBe('jpeg');
      expect(pngResult.format).toBe('png');
      expect(jpegResult.category).toBe('image');
      expect(pngResult.category).toBe('image');
    });

    it('DOC-014: 文件头不完整处理', async () => {
      // 创建文件头不完整的文件
      const incompleteHeader = [0x25, 0x50]; // PDF签名不完整
      const incompleteFile = createMockFile(incompleteHeader, 'incomplete.pdf', 'application/pdf');
      
      const result = await FileFormatDetector.detectFileFormat(incompleteFile);
      
      expect(result.confidence).toBeLessThan(0.7);
      expect(result.warnings).toContain('文件头信息不完整');
      expect(result.needsManualVerification).toBe(true);
    });

    it('DOC-015: MIME类型验证', async () => {
      // 正确的MIME类型
      const pdfFile = createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D], 'test.pdf', 'application/pdf');
      // 错误的MIME类型
      const wrongMimeFile = createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D], 'test.pdf', 'text/plain');
      
      const correctResult = await FileFormatDetector.detectFileFormat(pdfFile);
      const wrongResult = await FileFormatDetector.detectFileFormat(wrongMimeFile);
      
      expect(correctResult.mimeTypeValid).toBe(true);
      expect(wrongResult.mimeTypeValid).toBe(false);
      expect(wrongResult.warnings).toContain('MIME类型与文件内容不匹配');
    });

    it('DOC-016: 格式检测异常处理', async () => {
      // 创建一个会导致读取错误的模拟文件
      const problematicFile = {
        name: 'problem.pdf',
        size: 1000,
        type: 'application/pdf',
        arrayBuffer: () => Promise.reject(new Error('读取失败'))
      } as File;
      
      const result = await FileFormatDetector.detectFileFormat(problematicFile);
      
      expect(result.format).toBe('unknown');
      expect(result.errors).toContain('文件读取失败');
      expect(result.confidence).toBe(0);
    });

    it('DOC-017: 检测结果缓存机制', async () => {
      const pdfFile = createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D], 'cached.pdf', 'application/pdf');
      
      const start1 = performance.now();
      const result1 = await FileFormatDetector.detectFileFormat(pdfFile);
      const time1 = performance.now() - start1;
      
      const start2 = performance.now();
      const result2 = await FileFormatDetector.detectFileFormat(pdfFile);
      const time2 = performance.now() - start2;
      
      expect(result1.format).toBe(result2.format);
      expect(result2.cached).toBe(true);
      expect(time2).toBeLessThan(time1); // 缓存应该更快
    });

    it('DOC-018: 支持格式列表查询', () => {
      const supportedFormats = FileFormatDetector.getSupportedFormats();
      
      expect(supportedFormats).toContain('pdf');
      expect(supportedFormats).toContain('docx');
      expect(supportedFormats).toContain('doc');
      expect(supportedFormats.length).toBeGreaterThan(5);
      
      const formatInfo = FileFormatDetector.getFormatInfo('pdf');
      expect(formatInfo.name).toBe('PDF');
      expect(formatInfo.extension).toBe('.pdf');
      expect(formatInfo.mimeType).toBe('application/pdf');
    });

    it('DOC-019: 格式兼容性检查', async () => {
      const modernFile = createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D, 0x32, 0x2E, 0x30], 'modern.pdf', 'application/pdf');
      const oldFile = createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x32], 'old.pdf', 'application/pdf');
      
      const modernResult = await FileFormatDetector.detectFileFormat(modernFile);
      const oldResult = await FileFormatDetector.detectFileFormat(oldFile);
      
      expect(modernResult.version).toContain('2.0');
      expect(oldResult.version).toContain('1.2');
      expect(modernResult.compatibilityLevel).toBe('high');
      expect(oldResult.compatibilityLevel).toBe('medium');
    });
  });

  describe('性能和边界测试', () => {
    it('大量小文件并发检测', async () => {
      const files = Array(50).fill(0).map((_, i) => 
        createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D], `test${i}.pdf`, 'application/pdf')
      );
      
      const startTime = performance.now();
      const results = await Promise.all(files.map(file => FileFormatDetector.detectFileFormat(file)));
      const totalTime = performance.now() - startTime;
      
      expect(results).toHaveLength(50);
      expect(results.every(r => r.format === 'pdf')).toBe(true);
      expect(totalTime).toBeLessThan(5000); // 5秒内完成
    });

    it('内存使用优化验证', async () => {
      // 创建非常大的文件来测试内存优化
      const largeFile = createMockFile([0x25, 0x50, 0x44, 0x46, 0x2D], 'huge.pdf', 'application/pdf');
      Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 }); // 100MB
      
      const result = await FileFormatDetector.detectFileFormat(largeFile);
      
      expect(result.format).toBe('pdf');
      expect(result.optimizations).toContain('memory-efficient');
      expect(result.bytesRead).toBeLessThan(10 * 1024); // 应该只读取前几KB
    });
  });
});