/**
 * 中文水印功能集成测试
 * 基于用户提供的技术方案进行功能验证
 */

import { ChineseWatermarkRenderer } from './engines/canvas/ChineseWatermarkRenderer';
import { EnhancedDocumentProcessor } from './utils/document/EnhancedDocumentProcessor';
import { FileFormatDetector } from './utils/document/FileFormatDetector';
import { PDFWatermarkEngine } from './engines/pdf/PDFWatermarkEngine';
import { PDFDocument } from 'pdf-lib';
import type { WatermarkSettings } from './types/watermark.types';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  details: any;
  errors?: string[];
}

export class ChineseWatermarkIntegrationTest {
  
  /**
   * 运行所有集成测试
   */
  static async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 开始中文水印功能集成测试...');
    
    const results: TestResult[] = [];
    
    // 测试1: Canvas中文渲染
    results.push(await this.testCanvasChineseRendering());
    
    // 测试2: 文件格式检测
    results.push(await this.testFileFormatDetection());
    
    // 测试3: PDF水印引擎
    results.push(await this.testPDFWatermarkEngine());
    
    // 测试4: 端到端文档处理
    results.push(await this.testEndToEndDocumentProcessing());
    
    // 测试5: 网格水印覆盖
    results.push(await this.testGridWatermarkCoverage());

    console.log('📊 测试结果汇总:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.testName}: ${result.duration}ms`);
      if (!result.success && result.errors) {
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n🎯 测试完成: ${successCount}/${results.length} 通过`);

    return results;
  }

  /**
   * 测试1: Canvas中文渲染功能
   */
  private static async testCanvasChineseRendering(): Promise<TestResult> {
    const testName = 'Canvas中文渲染功能';
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      console.log('🎨 测试Canvas中文渲染...');

      // 测试中文文本检测
      const chineseTexts = ['水印测试', '机密文档', '版权所有', 'Watermark 中文'];
      const englishTexts = ['WATERMARK', 'CONFIDENTIAL', 'COPYRIGHT'];

      for (const text of chineseTexts) {
        const containsChinese = ChineseWatermarkRenderer.containsChineseCharacters(text);
        if (!containsChinese) {
          errors.push(`中文检测失败: "${text}" 应该被识别为包含中文`);
        }
      }

      for (const text of englishTexts) {
        const containsChinese = ChineseWatermarkRenderer.containsChineseCharacters(text);
        if (containsChinese) {
          errors.push(`中文检测失败: "${text}" 不应该被识别为包含中文`);
        }
      }

      // 测试中文水印图像创建
      const watermarkOptions = {
        text: '机密文档',
        fontSize: 24,
        color: '#FF0000',
        opacity: 0.5,
        rotation: -45
      };

      const watermarkImage = await ChineseWatermarkRenderer.createChineseWatermarkImage(watermarkOptions);

      if (!watermarkImage.canvas) {
        errors.push('Canvas创建失败');
      }

      if (!watermarkImage.blob || watermarkImage.blob.size === 0) {
        errors.push('水印Blob生成失败');
      }

      if (!watermarkImage.dataUrl.startsWith('data:image/png')) {
        errors.push('DataURL格式不正确');
      }

      if (watermarkImage.dimensions.width <= 0 || watermarkImage.dimensions.height <= 0) {
        errors.push('水印尺寸计算错误');
      }

      // 测试网格水印创建
      const gridWatermarks = await ChineseWatermarkRenderer.createGridWatermarkImages(
        watermarkOptions,
        595, // A4页面宽度
        842, // A4页面高度
        {
          spacingX: 200,
          spacingY: 150,
          stagger: true
        }
      );

      if (gridWatermarks.length === 0) {
        errors.push('网格水印创建失败');
      }

      console.log('✅ Canvas中文渲染测试完成:', {
        chineseDetectionTests: chineseTexts.length,
        englishDetectionTests: englishTexts.length,
        watermarkCreated: !!watermarkImage.canvas,
        gridWatermarksCount: gridWatermarks.length,
        totalErrors: errors.length
      });

    } catch (error) {
      errors.push(`测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    const duration = performance.now() - startTime;
    return {
      testName,
      success: errors.length === 0,
      duration,
      details: {
        canvasRenderingSupported: typeof document !== 'undefined' && !!document.createElement,
        errorsCount: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 测试2: 文件格式检测功能
   */
  private static async testFileFormatDetection(): Promise<TestResult> {
    const testName = '文件格式智能识别';
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      console.log('🔍 测试文件格式检测...');

      // 模拟不同格式的文件头
      const testCases = [
        {
          name: 'DOCX文件',
          signature: [0x50, 0x4B, 0x03, 0x04], // ZIP/DOCX
          expected: 'docx',
          fileName: 'test.docx'
        },
        {
          name: 'DOC文件',
          signature: [0xD0, 0xCF, 0x11, 0xE0], // OLE2/DOC
          expected: 'doc',
          fileName: 'test.doc'
        },
        {
          name: 'PDF文件',
          signature: [0x25, 0x50, 0x44, 0x46], // %PDF
          expected: 'pdf',
          fileName: 'test.pdf'
        },
        {
          name: 'PNG图像',
          signature: [0x89, 0x50, 0x4E, 0x47], // PNG
          expected: 'png',
          fileName: 'test.png'
        }
      ];

      for (const testCase of testCases) {
        // 创建模拟的ArrayBuffer
        const buffer = new ArrayBuffer(16);
        const view = new Uint8Array(buffer);
        testCase.signature.forEach((byte, index) => {
          view[index] = byte;
        });

        const result = FileFormatDetector.detectFileFormat(
          buffer,
          testCase.fileName,
          'application/octet-stream'
        );

        if (result.detectedFormat !== testCase.expected) {
          errors.push(`${testCase.name}格式检测失败: 期望${testCase.expected}, 实际${result.detectedFormat}`);
        }

        if (result.confidence < 0.8) {
          errors.push(`${testCase.name}检测置信度过低: ${result.confidence}`);
        }
      }

      // 测试Office文档格式识别
      const isOfficeDoc = FileFormatDetector.isOfficeDocument('docx');
      if (!isOfficeDoc) {
        errors.push('Office文档格式识别失败');
      }

      // 测试支持的格式列表
      const supportedFormats = FileFormatDetector.getSupportedFormats();
      if (supportedFormats.length === 0) {
        errors.push('未找到支持的格式');
      }

      console.log('✅ 文件格式检测测试完成:', {
        testCasesCount: testCases.length,
        supportedFormatsCount: supportedFormats.length,
        errorsCount: errors.length
      });

    } catch (error) {
      errors.push(`测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    const duration = performance.now() - startTime;
    return {
      testName,
      success: errors.length === 0,
      duration,
      details: {
        supportedFormatsCount: FileFormatDetector.getSupportedFormats().length,
        errorsCount: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 测试3: PDF水印引擎
   */
  private static async testPDFWatermarkEngine(): Promise<TestResult> {
    const testName = 'PDF水印引擎';
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      console.log('📄 测试PDF水印引擎...');

      // 创建测试PDF文档
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage([595, 842]); // A4
      const page2 = pdfDoc.addPage([595, 842]);

      // 添加一些测试内容
      page1.drawText('第一页测试内容', { x: 50, y: 800, size: 12 });
      page2.drawText('第二页测试内容', { x: 50, y: 800, size: 12 });

      // 测试不同的水印模式
      const watermarkConfigs = [
        {
          name: '单个水印',
          config: {
            text: '机密文档',
            fontSize: 24,
            color: '#FF0000',
            opacity: 0.3,
            rotation: -45,
            mode: 'single' as const
          }
        },
        {
          name: '网格水印',
          config: {
            text: '版权所有',
            fontSize: 18,
            color: '#0000FF',
            opacity: 0.2,
            rotation: -45,
            mode: 'grid' as const,
            grid: {
              spacingX: 200,
              spacingY: 150,
              stagger: true
            }
          }
        },
        {
          name: '边界水印',
          config: {
            text: '内部资料',
            fontSize: 20,
            color: '#00FF00',
            opacity: 0.4,
            rotation: 0,
            mode: 'boundary' as const,
            boundary: {
              margin: 50,
              corners: true,
              edges: true,
              center: true
            }
          }
        }
      ];

      for (const { name, config } of watermarkConfigs) {
        try {
          const result = await PDFWatermarkEngine.addGridWatermarkToPDF(pdfDoc, config);
          
          if (!result.success) {
            errors.push(`${name}测试失败: ${result.errors?.join(', ')}`);
          }

          if (result.watermarkCount === 0) {
            errors.push(`${name}未生成任何水印`);
          }

          console.log(`🎯 ${name}测试结果:`, {
            success: result.success,
            watermarkCount: result.watermarkCount,
            pageCount: result.pageCount,
            coveragePercentage: result.statistics.coveragePercentage
          });

        } catch (watermarkError) {
          errors.push(`${name}测试异常: ${watermarkError instanceof Error ? watermarkError.message : '未知错误'}`);
        }
      }

      // 测试水印布局预览
      const previewLayout = PDFWatermarkEngine.previewWatermarkLayout(
        595, 842, watermarkConfigs[1].config
      );

      if (previewLayout.length === 0) {
        errors.push('水印布局预览失败');
      }

      console.log('✅ PDF水印引擎测试完成:', {
        configsCount: watermarkConfigs.length,
        previewLayoutCount: previewLayout.length,
        errorsCount: errors.length
      });

    } catch (error) {
      errors.push(`测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    const duration = performance.now() - startTime;
    return {
      testName,
      success: errors.length === 0,
      duration,
      details: {
        watermarkModesCount: 3,
        errorsCount: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 测试4: 端到端文档处理
   */
  private static async testEndToEndDocumentProcessing(): Promise<TestResult> {
    const testName = '端到端文档处理';
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      console.log('🔄 测试端到端文档处理...');

      // 创建模拟的文档文件
      const mockDocxContent = this.createMockDocxContent();
      const mockFile = new File([mockDocxContent], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // 创建测试用的水印设置
      const watermarkSettings: WatermarkSettings = {
        type: 'text',
        text: {
          content: '机密文档 - 测试',
          font: {
            family: 'Arial',
            size: 24,
            weight: 'normal',
            style: 'normal'
          },
          color: '#FF0000'
        },
        position: {
          placement: 'pattern',
          opacity: 0.3,
          scale: 1.0,
          rotation: -45,
          blendMode: 'normal' as GlobalCompositeOperation,
          margin: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
          },
          pattern: {
            spacing: { x: 200, y: 150 },
            offset: { x: 0, y: 0 },
            stagger: true
          }
        },
        output: {
          format: 'png' as 'png' | 'jpeg' | 'webp',
          quality: 0.9,
          compression: { enabled: true, level: 'medium' }
        },
        security: {
          generateCertificate: false,
          hashAlgorithm: 'SHA-256' as 'SHA-256' | 'SHA-512',
          embedMetadata: true,
          tamperProtection: false,
          blockChineseCharacters: false,
          allowedLanguages: ['zh', 'en'] as ('en' | 'zh' | 'ja' | 'ko' | 'all')[]
        }
      };

      // 测试增强文档处理器
      try {
        const result = await EnhancedDocumentProcessor.processDocument(mockFile, watermarkSettings);
        
        if (!result.success) {
          errors.push(`文档处理失败: ${result.error}`);
        } else {
          if (!result.processedDocument) {
            errors.push('处理后文档为空');
          }
          
          if (!result.extractionDetails.success) {
            errors.push(`内容提取失败: ${result.extractionDetails.errors?.join(', ')}`);
          }

          console.log('📋 文档处理结果:', {
            success: result.success,
            extractionMethod: result.extractionDetails.method,
            fileFormat: result.extractionDetails.fileFormat.detected,
            textLength: result.extractionDetails.extractedText.length,
            processingTime: result.processingTime
          });
        }

      } catch (processingError) {
        // 由于依赖问题，这里可能会失败，但不应该影响其他测试
        console.warn('⚠️ 文档处理测试跳过（缺少依赖）:', processingError);
        errors.push('文档处理需要mammoth依赖');
      }

      console.log('✅ 端到端文档处理测试完成');

    } catch (error) {
      errors.push(`测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    const duration = performance.now() - startTime;
    return {
      testName,
      success: errors.length === 0,
      duration,
      details: {
        dependencyAvailable: false, // mammoth等依赖可能不可用
        errorsCount: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 测试5: 网格水印覆盖
   */
  private static async testGridWatermarkCoverage(): Promise<TestResult> {
    const testName = '网格水印覆盖测试';
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      console.log('🔲 测试网格水印覆盖...');

      const pageWidth = 595;
      const pageHeight = 842;
      
      // 测试不同密度的网格覆盖
      const densityTests = [
        { density: 'low', expectedMin: 6, expectedMax: 15 },
        { density: 'medium', expectedMin: 15, expectedMax: 30 },
        { density: 'high', expectedMin: 30, expectedMax: 60 }
      ];

      for (const test of densityTests) {
        const config = {
          text: '测试水印',
          fontSize: 20,
          color: '#000000',
          opacity: 0.3,
          rotation: -45,
          mode: 'adaptive' as const,
          adaptive: {
            density: test.density as 'low' | 'medium' | 'high',
            minSpacing: 100,
            maxCount: 100
          }
        };

        const layout = PDFWatermarkEngine.previewWatermarkLayout(pageWidth, pageHeight, config);
        
        if (layout.length < test.expectedMin || layout.length > test.expectedMax) {
          errors.push(`${test.density}密度水印数量异常: ${layout.length} (期望${test.expectedMin}-${test.expectedMax})`);
        }

        console.log(`🎯 ${test.density}密度测试:`, {
          watermarkCount: layout.length,
          expectedRange: `${test.expectedMin}-${test.expectedMax}`,
          passed: layout.length >= test.expectedMin && layout.length <= test.expectedMax
        });
      }

      // 测试覆盖率计算
      const gridConfig = {
        text: '网格测试',
        fontSize: 24,
        color: '#0000FF',
        opacity: 0.2,
        rotation: -45,
        mode: 'grid' as const,
        grid: {
          spacingX: 200,
          spacingY: 150,
          stagger: true
        }
      };

      const gridLayout = PDFWatermarkEngine.previewWatermarkLayout(pageWidth, pageHeight, gridConfig);
      
      if (gridLayout.length === 0) {
        errors.push('网格布局生成失败');
      }

      // 验证水印位置不重叠且在页面范围内
      const margin = 50;
      for (let i = 0; i < gridLayout.length; i++) {
        const pos = gridLayout[i];
        
        if (pos.x < margin || pos.x > pageWidth - margin || 
            pos.y < margin || pos.y > pageHeight - margin) {
          errors.push(`水印位置超出页面范围: (${pos.x}, ${pos.y})`);
          break;
        }
      }

      console.log('✅ 网格水印覆盖测试完成:', {
        densityTestsCount: densityTests.length,
        gridLayoutCount: gridLayout.length,
        errorsCount: errors.length
      });

    } catch (error) {
      errors.push(`测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    const duration = performance.now() - startTime;
    return {
      testName,
      success: errors.length === 0,
      duration,
      details: {
        coverageModes: ['low', 'medium', 'high'],
        errorsCount: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 创建模拟的DOCX内容
   */
  private static createMockDocxContent(): ArrayBuffer {
    // 创建一个最简单的ZIP结构来模拟DOCX
    const zipSignature = new Uint8Array([0x50, 0x4B, 0x03, 0x04]); // ZIP signature
    const padding = new Uint8Array(100).fill(0);
    
    const combined = new Uint8Array(zipSignature.length + padding.length);
    combined.set(zipSignature, 0);
    combined.set(padding, zipSignature.length);
    
    return combined.buffer;
  }

  /**
   * 验证测试环境
   */
  static validateTestEnvironment(): {
    canvasSupport: boolean;
    pdfLibSupport: boolean;
    fileApiSupport: boolean;
  } {
    return {
      canvasSupport: typeof document !== 'undefined' && !!document.createElement,
      pdfLibSupport: typeof PDFDocument !== 'undefined',
      fileApiSupport: typeof File !== 'undefined' && typeof FileReader !== 'undefined'
    };
  }
}

// 如果在浏览器环境中，自动运行测试
if (typeof window !== 'undefined') {
  console.log('🧪 浏览器环境检测到，准备运行中文水印集成测试...');
  
  // 延迟运行以确保所有模块加载完成
  setTimeout(async () => {
    const environment = ChineseWatermarkIntegrationTest.validateTestEnvironment();
    console.log('🔧 测试环境:', environment);
    
    if (environment.canvasSupport && environment.pdfLibSupport && environment.fileApiSupport) {
      await ChineseWatermarkIntegrationTest.runAllTests();
    } else {
      console.warn('⚠️ 测试环境不完整，跳过部分测试');
    }
  }, 1000);
}

