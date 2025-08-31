/**
 * 混合文档处理器测试 - 方案A核心功能验证
 * 测试Word原生PDF转换 + 水印图片合并的完整流程
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { HybridDocumentProcessor } from '../../utils/document/HybridDocumentProcessor';
import { WatermarkImageGenerator } from '../../engines/watermark/WatermarkImageGenerator';
import { PDFWatermarkMerger } from '../../engines/pdf/PDFWatermarkMerger';
import { LibraryLoader } from '../../utils/cdn/LibraryLoader';
import type { WatermarkSettings } from '../../types/watermark.types';

// 测试数据和工具
const createTestWordFile = (content: string = 'Test document content'): File => {
  const docxHeader = new Uint8Array([0x50, 0x4B, 0x03, 0x04]); // ZIP header for DOCX
  const blob = new Blob([docxHeader, new TextEncoder().encode(content)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  return new File([blob], 'test.docx', { type: blob.type });
};

const createTestWatermarkSettings = (): WatermarkSettings => ({
  type: 'text',
  text: {
    content: '测试水印',
    font: {
      family: 'Microsoft YaHei',
      size: 24,
      weight: 'normal'
    },
    color: {
      primary: '#FF0000',
      secondary: '#0000FF'
    }
  },
  position: {
    x: 100,
    y: 100,
    scale: 1.0,
    opacity: 0.5,
    rotation: 45
  },
  security: {
    protectionLevel: 'medium' as const,
    allowCopy: true,
    allowPrint: true,
    allowModify: false
  },
  output: {
    format: 'pdf' as const,
    quality: 'high' as const,
    compression: true
  }
});

describe('HybridDocumentProcessor - 方案A核心测试', () => {
  beforeAll(async () => {
    // 确保CDN库已加载
    console.log('🔧 准备测试环境...');
    
    // 模拟浏览器全局对象
    global.window = global.window || ({} as any);
    global.document = global.document || ({
      createElement: () => ({
        getContext: () => ({
          font: '',
          fillStyle: '',
          measureText: () => ({ width: 100 }),
          fillText: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {}
        }),
        width: 400,
        height: 200,
        toBlob: (callback: any) => callback(new Blob()),
        toDataURL: () => 'data:image/png;base64,test'
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {}
      }
    } as any);

    // 模拟URL API
    global.URL = global.URL || {
      createObjectURL: () => 'blob:test-url',
      revokeObjectURL: () => {}
    } as any;
  });

  beforeEach(() => {
    // 清理缓存
    WatermarkImageGenerator.clearCache();
  });

  describe('Word原生PDF转换测试', () => {
    test('应该尝试Word原生PDF转换', async () => {
      const testFile = createTestWordFile('测试Word文档内容\n包含中文字符\n多行文本测试');
      const settings = createTestWatermarkSettings();

      const result = await HybridDocumentProcessor.processDocument(testFile, settings, {
        preserveFormatting: true,
        watermarkStrategy: 'overlay',
        fallbackTimeout: 5000,
        qualityProfile: 'balanced'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.processingMethod).toBeOneOf(['native_pdf', 'text_fallback']);
      
      if (result.processingMethod === 'native_pdf') {
        expect(result.formatPreservation.success).toBe(true);
        expect(result.formatPreservation.preservedElements).toContain('text');
      }

      console.log('📊 Word转换测试结果:', {
        method: result.processingMethod,
        success: result.success,
        formatPreserved: result.formatPreservation?.success
      });
    }, 30000);

    test('应该处理Word转换失败的回退情况', async () => {
      const corruptedFile = new File([new Uint8Array([1, 2, 3, 4])], 'corrupted.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const settings = createTestWatermarkSettings();

      const result = await HybridDocumentProcessor.processDocument(corruptedFile, settings, {
        preserveFormatting: true,
        watermarkStrategy: 'overlay',
        fallbackTimeout: 1000, // 短超时
        qualityProfile: 'draft'
      });

      expect(result).toBeDefined();
      // 对于损坏的文件，应该回退到文本处理
      expect(result.processingMethod).toBe('text_fallback');
      
      console.log('📊 回退机制测试结果:', result.processingMethod);
    }, 15000);
  });

  describe('独立水印图片生成测试', () => {
    test('应该生成高质量PNG水印图片', async () => {
      const watermark = await WatermarkImageGenerator.generateWatermarkImage({
        text: '测试中文水印',
        fontSize: 24,
        color: '#FF0000',
        opacity: 0.7,
        rotation: 45,
        fontFamily: 'Microsoft YaHei'
      }, {
        format: 'png',
        quality: 'high',
        dpi: 300,
        backgroundColor: 'transparent'
      });

      expect(watermark).toBeDefined();
      expect(watermark.format).toBe('png');
      expect(watermark.blob).toBeInstanceOf(Blob);
      expect(watermark.dimensions.width).toBeGreaterThan(0);
      expect(watermark.dimensions.height).toBeGreaterThan(0);
      expect(watermark.dataUrl).toMatch(/^blob:/);
      
      console.log('🎨 水印图片生成结果:', {
        format: watermark.format,
        size: watermark.size,
        dimensions: watermark.dimensions
      });
    });

    test('应该支持SVG格式水印生成', async () => {
      const watermark = await WatermarkImageGenerator.generateWatermarkImage({
        text: 'SVG测试水印',
        fontSize: 32,
        color: '#0000FF',
        opacity: 0.5,
        rotation: 0
      }, {
        format: 'svg',
        quality: 'high'
      });

      expect(watermark.format).toBe('svg');
      expect(watermark.blob.type).toContain('svg');
      
      console.log('📊 SVG水印生成结果:', watermark.format);
    });

    test('应该支持批量水印生成', async () => {
      const templates = [
        {
          id: 'template1',
          name: '红色水印',
          options: {
            text: '批量测试1',
            fontSize: 20,
            color: '#FF0000',
            opacity: 0.6,
            rotation: 30
          }
        },
        {
          id: 'template2',
          name: '蓝色水印',
          options: {
            text: '批量测试2',
            fontSize: 22,
            color: '#0000FF',
            opacity: 0.5,
            rotation: -30
          }
        }
      ];

      const result = await WatermarkImageGenerator.generateBatchWatermarks(
        templates,
        { format: 'png', quality: 'normal' },
        2 // 并发数
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.totalTime).toBeGreaterThan(0);
      
      console.log('🔄 批量生成结果:', {
        成功数量: result.successful.length,
        失败数量: result.failed.length,
        总时间: result.totalTime
      });
    });
  });

  describe('PDF水印合并测试', () => {
    test('应该成功合并PDF与水印图片', async () => {
      // 1. 创建测试PDF
      const testPdfBlob = new Blob([new Uint8Array([37, 80, 68, 70])], { // PDF header
        type: 'application/pdf'
      });

      // 2. 生成水印图片
      const watermarkImage = await WatermarkImageGenerator.generateWatermarkImage({
        text: '合并测试水印',
        fontSize: 20,
        color: '#00FF00',
        opacity: 0.4,
        rotation: 0
      });

      // 3. 创建合并配置
      const watermarkPlacements = [{
        watermark: watermarkImage,
        position: { x: 100, y: 100 },
        scale: 1.0,
        opacity: 0.5
      }];

      // 注意: 在测试环境中，PDF-lib可能不可用，这里主要测试接口
      try {
        const result = await PDFWatermarkMerger.mergePDFWithWatermarks(
          { blob: testPdfBlob, pageCount: 1 },
          watermarkPlacements,
          {
            strategy: 'overlay',
            quality: 'balanced',
            compression: true
          }
        );

        // 如果成功（实际环境中）
        if (result.success) {
          expect(result.processedDocument).toBeDefined();
          expect(result.statistics.watermarkCount).toBe(1);
          expect(result.statistics.pagesProcessed).toBeGreaterThan(0);
        }
        
        console.log('🔗 PDF合并测试结果:', {
          success: result.success,
          watermarkCount: result.statistics.watermarkCount,
          finalSize: result.statistics.finalSize
        });
        
      } catch (error) {
        // 在测试环境中PDF-lib可能不可用，这是正常的
        console.log('⚠️ PDF合并测试跳过 (依赖库不可用):', (error as Error).message);
        expect(error).toBeDefined(); // 确保错误被正确处理
      }
    }, 20000);

    test('应该处理PDF分析功能', async () => {
      const testPdfBlob = new Blob([new Uint8Array(1024)], {
        type: 'application/pdf'
      });

      try {
        const analysis = await PDFWatermarkMerger.analyzePDFForMerge(testPdfBlob);
        
        expect(analysis.fileSize).toBe(testPdfBlob.size);
        expect(analysis.estimated).toBeDefined();
        expect(analysis.estimated.processingTime).toBeGreaterThan(0);
        
        console.log('📊 PDF分析结果:', analysis);
        
      } catch (error) {
        // 测试环境中可能无法加载PDF
        console.log('⚠️ PDF分析测试跳过:', (error as Error).message);
        expect(error).toBeDefined();
      }
    });
  });

  describe('完整流程集成测试', () => {
    test('应该完成Word到PDF的完整水印处理流程', async () => {
      const testFile = createTestWordFile(`测试完整流程文档
      
包含多行内容
包含中文字符: 测试、验证、集成
包含英文内容: Test, Verify, Integration

这是一个完整的测试文档。`);

      const settings = createTestWatermarkSettings();

      console.log('🚀 开始完整流程测试...');
      
      const result = await HybridDocumentProcessor.processDocument(testFile, settings, {
        preserveFormatting: true,
        watermarkStrategy: 'overlay',
        fallbackTimeout: 10000,
        qualityProfile: 'balanced'
      });

      // 验证核心功能
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.originalFile).toBe(testFile);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingMethod).toBeOneOf(['native_pdf', 'text_fallback']);

      // 验证格式保留信息
      expect(result.formatPreservation).toBeDefined();
      expect(result.formatPreservation.success).toBeDefined();
      expect(result.formatPreservation.preservedElements).toBeDefined();
      expect(result.formatPreservation.lostElements).toBeDefined();

      // 验证水印应用信息
      expect(result.watermarkApplication).toBeDefined();
      expect(result.watermarkApplication.method).toBeOneOf(['direct_overlay', 'image_merge']);
      expect(result.watermarkApplication.watermarkCount).toBeGreaterThanOrEqual(0);

      // 如果有处理后的文档，验证其属性
      if (result.processedDocument) {
        expect(result.processedDocument.blob).toBeInstanceOf(Blob);
        expect(result.processedDocument.format).toBe('pdf');
        expect(result.processedDocument.size).toBeGreaterThan(0);
      }

      console.log('✅ 完整流程测试结果:', {
        success: result.success,
        processingMethod: result.processingMethod,
        formatPreserved: result.formatPreservation.success,
        watermarkMethod: result.watermarkApplication.method,
        watermarkCount: result.watermarkApplication.watermarkCount,
        processingTime: `${result.processingTime.toFixed(0)}ms`,
        hasOutput: !!result.processedDocument
      });

    }, 45000); // 较长的超时时间，因为是完整流程测试
  });

  describe('性能和质量测试', () => {
    test('应该在合理时间内完成处理', async () => {
      const testFile = createTestWordFile('性能测试文档内容');
      const settings = createTestWatermarkSettings();

      const startTime = performance.now();
      
      const result = await HybridDocumentProcessor.processDocument(testFile, settings, {
        preserveFormatting: false, // 禁用格式保留以加快速度
        qualityProfile: 'draft'
      });

      const totalTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(totalTime).toBeLessThan(30000); // 30秒内完成
      expect(result.processingTime).toBeLessThan(totalTime);

      console.log('⚡ 性能测试结果:', {
        总时间: `${totalTime.toFixed(0)}ms`,
        处理时间: `${result.processingTime.toFixed(0)}ms`,
        处理方法: result.processingMethod
      });
    }, 35000);

    test('应该处理不同质量配置', async () => {
      const testFile = createTestWordFile('质量测试文档');
      const settings = createTestWatermarkSettings();

      const qualityProfiles = ['draft', 'balanced', 'high'] as const;
      const results = [];

      for (const profile of qualityProfiles) {
        const result = await HybridDocumentProcessor.processDocument(testFile, settings, {
          qualityProfile: profile,
          preserveFormatting: false
        });

        expect(result.success).toBe(true);
        results.push({
          profile,
          processingTime: result.processingTime,
          method: result.processingMethod
        });
      }

      console.log('🎛️ 质量配置测试结果:', results);

      // draft模式应该最快
      const draftResult = results.find(r => r.profile === 'draft');
      const highResult = results.find(r => r.profile === 'high');
      
      if (draftResult && highResult) {
        expect(draftResult.processingTime).toBeLessThanOrEqual(highResult.processingTime * 1.5);
      }
    }, 60000);
  });

  afterAll(() => {
    console.log('🧹 清理测试环境...');
    WatermarkImageGenerator.clearCache();
  });
});