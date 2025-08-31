/**
 * DocumentProcessor 单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DocumentProcessor } from '../document/DocumentProcessor';
import type { SimpleWatermarkSettings } from '../watermark/SimpleWatermarkProcessor';

// 模拟PDF.js
vi.mock('pdfjs-dist', () => {
  return {
    version: '3.11.174',
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn().mockImplementation((options) => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockImplementation((pageNum) => 
          Promise.resolve({
            getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
            render: vi.fn().mockReturnValue({ promise: Promise.resolve() })
          })
        )
      })
    }))
  };
});

// 模拟Mammoth
vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn().mockImplementation(() => 
      Promise.resolve({
        value: '<p>Mock Word document content</p>',
        messages: []
      })
    )
  }
}));

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  let mockSettings: SimpleWatermarkSettings;

  beforeEach(() => {
    processor = new DocumentProcessor();
    mockSettings = {
      type: 'text',
      text: {
        content: '测试水印',
        font: { family: 'Arial', size: 24, weight: 'normal', style: 'normal' },
        color: '#FF0000'
      },
      position: {
        placement: 'center',
        corner: 'bottom-right',
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        opacity: 0.7,
        scale: 1.0,
        rotation: 0,
        blendMode: 'normal'
      },
      output: {
        format: 'png',
        quality: 0.9,
        preserveOriginalMetadata: false,
        compression: { enabled: true, level: 'medium' }
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processDocument', () => {
    it('should process PDF files', async () => {
      const mockPDFFile = new File(['mock pdf content'], 'test.pdf', { 
        type: 'application/pdf' 
      });

      const result = await processor.processDocument(mockPDFFile, mockSettings);

      expect(result.success).toBe(true);
      expect(result.originalFile).toBe(mockPDFFile);
      expect(result.processedDocument).toBeDefined();
      expect(result.processedDocument?.format).toBe('png');
      expect(result.processedDocument?.pageCount).toBe(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should process Word files', async () => {
      const mockWordFile = new File(['mock word content'], 'test.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      const result = await processor.processDocument(mockWordFile, mockSettings);

      expect(result.success).toBe(true);
      expect(result.originalFile).toBe(mockWordFile);
      expect(result.processedDocument).toBeDefined();
      expect(result.processedDocument?.format).toBe('png');
      expect(result.processedDocument?.pageCount).toBe(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle unsupported file types', async () => {
      const mockUnsupportedFile = new File(['mock content'], 'test.txt', { 
        type: 'text/plain' 
      });

      const result = await processor.processDocument(mockUnsupportedFile, mockSettings);

      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的文档格式');
    });

    it('should handle processing errors gracefully', async () => {
      // 模拟PDF.js抛出错误
      const pdfjs = await import('pdfjs-dist');
      const mockGetDocument = vi.fn().mockReturnValue({
        promise: Promise.reject(new Error('PDF parsing failed'))
      });
      
      // 临时替换mock
      (pdfjs as any).getDocument = mockGetDocument;

      const mockPDFFile = new File(['corrupted pdf'], 'corrupted.pdf', { 
        type: 'application/pdf' 
      });

      const result = await processor.processDocument(mockPDFFile, mockSettings);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('getFileType', () => {
    it('should correctly identify PDF files', () => {
      const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(processor['getFileType'](pdfFile)).toBe('pdf');
    });

    it('should correctly identify Word files', () => {
      const docxFile = new File([''], 'test.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      expect(processor['getFileType'](docxFile)).toBe('word');

      const docFile = new File([''], 'test.doc', { type: 'application/msword' });
      expect(processor['getFileType'](docFile)).toBe('word');
    });

    it('should identify unknown file types', () => {
      const unknownFile = new File([''], 'test.txt', { type: 'text/plain' });
      expect(processor['getFileType'](unknownFile)).toBe('unknown');
    });
  });

  describe('canvasToBlob', () => {
    it('should convert canvas to blob', async () => {
      const mockCanvas = document.createElement('canvas');
      
      const blob = await processor['canvasToBlob'](mockCanvas, 'png', 0.9);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
    });

    it('should handle conversion errors', async () => {
      const mockCanvas = document.createElement('canvas');
      // 模拟toBlob失败
      mockCanvas.toBlob = vi.fn((callback) => {
        callback?.(null);
      });

      await expect(processor['canvasToBlob'](mockCanvas, 'png', 0.9))
        .rejects.toThrow('Canvas转换为Blob失败');
    });
  });

  describe('addWatermarkToCanvas', () => {
    it('should add text watermark to canvas', async () => {
      const mockCanvas = document.createElement('canvas');
      const mockContext = mockCanvas.getContext('2d')!;
      
      await processor['addWatermarkToCanvas'](mockContext, mockCanvas, mockSettings);
      
      expect(mockContext.fillText).toHaveBeenCalledWith(
        mockSettings.text!.content, 
        expect.any(Number), 
        expect.any(Number)
      );
    });

    it('should handle different watermark placements', async () => {
      const mockCanvas = document.createElement('canvas');
      const mockContext = mockCanvas.getContext('2d')!;
      
      const cornerSettings = {
        ...mockSettings,
        position: {
          ...mockSettings.position,
          placement: 'corner' as const,
          corner: 'top-left' as const
        }
      };

      await processor['addWatermarkToCanvas'](mockContext, mockCanvas, cornerSettings);
      
      expect(mockContext.fillText).toHaveBeenCalled();
      expect(mockContext.textAlign).toBe('left');
      expect(mockContext.textBaseline).toBe('top');
    });
  });
});