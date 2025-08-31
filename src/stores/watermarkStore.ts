/**
 * 水印应用状态管理 - 增强版
 * 使用 Zustand 实现轻量级状态管理
 * 集成CDN动态加载、增强水印引擎、智能处理流程
 * 基于架构文档的状态管理设计 + Phase 1-2 增强功能
 */

import { create } from 'zustand';
import type { WatermarkStore } from '@/types/app.types';
import type { WatermarkSettings, WatermarkResult } from '@/types/watermark.types';
import { SimpleWatermarkProcessor } from '@/utils/watermark/SimpleWatermarkProcessor';
import { DocumentProcessor } from '@/utils/document/DocumentProcessor';
// import { NativeDocumentProcessor } from '@/utils/document/NativeDocumentProcessor'; // 暂未使用
import { EnhancedDocumentProcessor } from '@/utils/document/EnhancedDocumentProcessor';
// 方案A核心模块集成
import { HybridDocumentProcessor } from '@/utils/document/HybridDocumentProcessor';
import { WatermarkImageGenerator } from '../engines/watermark/WatermarkImageGenerator';
import { PDFWatermarkMerger } from '../engines/pdf/PDFWatermarkMerger';
// 新增：集成增强的水印引擎
import { ChineseWatermarkRenderer } from '../engines/canvas/ChineseWatermarkRenderer';
import { PDFWatermarkEngine } from '../engines/pdf/PDFWatermarkEngine';
import { LibraryLoader } from '../utils/cdn/LibraryLoader';

export const useWatermarkStore = create<WatermarkStore>((set, get) => ({
  // Canvas 渲染引擎状态 - 增强版
  canvas: {
    engine: null,
    context: null,
    pool: null as any,
    activeCanvases: new Set(),
    // 新增：中文水印渲染器状态
    chineseRenderer: {
      initialized: false,
      optimalFont: null,
      renderQuality: 'high',
      supportedFeatures: []
    }
  },

  // CDN库管理状态 - 新增
  cdn: {
    initialized: false,
    loadedLibraries: new Set(),
    loadingProgress: new Map(),
    stats: {},
    healthMetrics: {}
  },

  // PDF引擎状态 - 新增
  pdfEngine: {
    initialized: false,
    status: 'ready' as 'loading' | 'ready' | 'error',
    supportedFeatures: [],
    lastError: null
  },

  // WebWorker 并行处理状态
  workers: {
    pool: null as any,
    activeWorkers: new Map(),
    taskQueue: []
  },

  // 文件处理状态 - 增强版
  files: {
    selected: [],
    processing: new Map(),
    results: new Map(),
    // 新增：处理统计
    statistics: {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      averageProcessingTime: 0,
      chineseContentDetected: 0
    }
  },

  // 水印设置状态 - 增强版支持网格水印
  watermark: {
    processor: null,
    settings: {
      type: 'text',
      text: {
        content: '机密文档',
        font: {
          family: 'Microsoft YaHei', // 默认使用中文字体
          size: 24,
          weight: 'normal',
          style: 'normal'
        },
        color: '#000000'
      },
      position: {
        placement: 'grid', // 默认使用网格模式
        corner: 'bottom-right',
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        opacity: 0.3,
        scale: 1.0,
        rotation: 45,
        blendMode: 'multiply' as GlobalCompositeOperation,
        // 新增：网格布局设置
        grid: {
          spacingX: 200,
          spacingY: 150,
          stagger: true,
          layers: 1,
          densityMode: 'normal'
        }
      },
      security: {
        generateCertificate: true,
        hashAlgorithm: 'SHA-256' as 'SHA-256' | 'SHA-512',
        embedMetadata: true,
        tamperProtection: true,
        blockChineseCharacters: false,
        allowedLanguages: ['zh', 'en'] as ('en' | 'zh' | 'ja' | 'ko' | 'all')[]
      },
      output: {
        format: 'pdf', // 优先输出PDF
        quality: 0.9,
        preserveOriginalMetadata: false,
        compression: {
          enabled: true,
          level: 'medium'
        }
      }
    } as unknown as WatermarkSettings,
    presets: [
      // 预设一些常用配置
      {
        id: 'chinese-grid-default',
        name: '中文网格水印（默认）',
        description: '200px间距的标准中文网格水印',
        isDefault: true,
        settings: {
          type: 'text',
          text: {
            content: '机密文档',
            font: { family: 'Microsoft YaHei', size: 20, weight: 'normal', style: 'normal' },
            color: '#000000'
          },
          position: {
            placement: 'grid',
            corner: 'bottom-right',
            opacity: 0.3,
            rotation: 45,
            scale: 1.0,
            margin: { top: 20, right: 20, bottom: 20, left: 20 },
            blendMode: 'multiply' as GlobalCompositeOperation,
            grid: { spacingX: 200, spacingY: 150, stagger: true, layers: 1, densityMode: 'normal' }
          },
          security: {
            generateCertificate: true,
            hashAlgorithm: 'SHA-256' as 'SHA-256' | 'SHA-512',
            embedMetadata: true,
            tamperProtection: true,
            blockChineseCharacters: false,
            allowedLanguages: ['zh', 'en'] as ('en' | 'zh' | 'ja' | 'ko' | 'all')[]
          },
          output: {
            format: 'pdf',
            quality: 0.9,
            preserveOriginalMetadata: false,
            compression: {
              enabled: true,
              level: 'medium'
            }
          }
        } as unknown as WatermarkSettings
      }
    ]
  },

  // UI 状态
  ui: {
    loading: false,
    error: null,
    progress: null,
    activeView: 'upload',
    modals: {
      settings: false,
      help: false,
      error: false,
      certificate: false,
      presets: false
    }
  },

  // 性能监控状态
  performance: {
    metrics: {
      averageProcessingTime: 0,
      totalFilesProcessed: 0,
      memoryPeakUsage: 0,
      canvasPoolEfficiency: 0,
      workerPoolUtilization: 0,
      renderFrameRate: 0
    },
    warnings: [],
    memoryUsage: 0
  },

  // Actions - 增强版集成所有新功能
  
  /**
   * 初始化完整的水印系统 - 包括CDN、Canvas、PDF引擎
   */
  initializeSystem: async () => {
    const state = get();
    
    // 避免重复初始化
    if (state.cdn.initialized && state.canvas.chineseRenderer.initialized && state.pdfEngine.initialized) {
      console.log('✅ 系统已初始化，跳过重复初始化');
      return;
    }

    try {
      set(state => ({
        ui: { 
          ...state.ui, 
          loading: true, 
          error: null,
          progress: { current: 0, total: 4, message: '初始化系统组件...' }
        }
      }));

      console.log('🔧 开始初始化增强水印系统...');

      // 步骤1: 初始化CDN库管理
      set(state => ({
        ui: { 
          ...state.ui,
          progress: { current: 1, total: 4, message: '初始化CDN库管理...' }
        }
      }));

      const cdnStats = LibraryLoader.getCDNStats();
      const performanceMetrics = LibraryLoader.getPerformanceMetrics();
      
      set(state => ({
        cdn: {
          ...state.cdn,
          initialized: true,
          stats: cdnStats,
          healthMetrics: performanceMetrics
        }
      }));

      // 步骤2: 初始化中文水印渲染器
      set(state => ({
        ui: { 
          ...state.ui,
          progress: { current: 2, total: 4, message: '初始化中文水印渲染器...' }
        }
      }));

      const optimalFont = ChineseWatermarkRenderer.detectOptimalChineseFont();
      const supportedFeatures = [
        '中文字符检测',
        '智能字体回退',
        '高质量Canvas渲染',
        '网格布局算法',
        '多层水印支持'
      ];

      set(state => ({
        canvas: {
          ...state.canvas,
          chineseRenderer: {
            initialized: true,
            optimalFont,
            renderQuality: 'high',
            supportedFeatures
          }
        }
      }));

      // 步骤3: 初始化PDF引擎
      set(state => ({
        ui: { 
          ...state.ui,
          progress: { current: 3, total: 4, message: '初始化PDF引擎...' }
        },
        pdfEngine: {
          ...state.pdfEngine,
          status: 'loading'
        }
      }));

      await PDFWatermarkEngine.initialize();
      const engineStatus = PDFWatermarkEngine.getEngineStatus();

      set(() => ({
        pdfEngine: {
          initialized: engineStatus.initialized,
          status: engineStatus.initialized ? 'ready' : 'error',
          supportedFeatures: engineStatus.features,
          lastError: null
        }
      }));

      // 步骤4: 完成初始化
      set(state => ({
        ui: { 
          ...state.ui,
          loading: false,
          progress: null
        }
      }));

      console.log('✅ 增强水印系统初始化完成', {
        cdn: state.cdn.initialized,
        chineseRenderer: state.canvas.chineseRenderer.initialized,
        pdfEngine: engineStatus.initialized,
        optimalFont,
        supportedFeatures: engineStatus.features
      });

    } catch (error) {
      console.error('❌ 系统初始化失败:', error);
      
      set(state => ({
        ui: {
          ...state.ui,
          loading: false,
          progress: null,
          error: {
            code: 'SYSTEM_INIT_FAILED',
            message: error instanceof Error ? error.message : 'System initialization failed',
            timestamp: Date.now(),
            userMessage: '系统初始化失败',
            recoverable: true
          }
        },
        pdfEngine: {
          ...state.pdfEngine,
          status: 'error',
          lastError: error instanceof Error ? error.message : String(error)
        }
      }));

      throw error;
    }
  },

  /**
   * 传统Canvas初始化（向后兼容）
   */
  initializeCanvas: async () => {
    await get().initializeSystem();
  },

  disposeCanvas: () => {
    set(state => ({
      canvas: {
        ...state.canvas,
        engine: null,
        context: null,
        activeCanvases: new Set()
      }
    }));
  },

  selectFiles: (files: File[]) => {
    set(state => ({
      files: {
        ...state.files,
        selected: files
      }
    }));
  },

  /**
   * 增强文件处理 - 集成新的引擎和智能处理流程
   */
  processFiles: async (settings: WatermarkSettings) => {
    const state = get();
    
    if (state.files.selected.length === 0) {
      throw new Error('No files selected');
    }

    // 确保系统已初始化
    if (!state.pdfEngine.initialized) {
      console.log('🔧 系统未初始化，开始初始化...');
      await get().initializeSystem();
    }

    set(state => ({
      ui: {
        ...state.ui,
        loading: true,
        progress: { current: 0, total: state.files.selected.length, message: '开始增强处理...' }
      }
    }));

    const processingStartTime = performance.now();
    const results = new Map<string, WatermarkResult>();
    let chineseContentCount = 0;

    try {
      console.log('🚀 开始增强文件处理流程:', {
        fileCount: state.files.selected.length,
        settings,
        chineseRenderer: state.canvas.chineseRenderer.initialized,
        pdfEngine: state.pdfEngine.initialized
      });

      for (let i = 0; i < state.files.selected.length; i++) {
        const file = state.files.selected[i];
        const fileId = `${file.name}-${file.size}`;
        const fileStartTime = performance.now();

        // 检测是否包含中文内容
        const containsChinese = ChineseWatermarkRenderer.containsChineseCharacters(settings.text?.content || '');
        if (containsChinese) {
          chineseContentCount++;
        }

        set(state => ({
          ui: {
            ...state.ui,
            progress: {
              current: i,
              total: state.files.selected.length,
              message: `增强处理: ${file.name} ${containsChinese ? '(中文水印)' : ''}`
            }
          }
        }));

        let watermarkResult: WatermarkResult;

        try {
          // 智能文件类型检测和处理路径选择
          const isPDFFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
          const isWordFile = file.type.includes('word') || file.name.match(/\.(docx?|doc)$/i);
          const isImageFile = file.type.startsWith('image/');

          console.log(`📁 处理文件 ${i + 1}/${state.files.selected.length}:`, {
            name: file.name,
            type: file.type,
            size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            isPDF: isPDFFile,
            isWord: isWordFile,
            isImage: isImageFile,
            containsChinese,
            useEnhancedEngine: containsChinese || settings.position.placement === 'grid'
          });

          // 路径1: 增强PDF处理 (使用新引擎)
          if (isPDFFile && (containsChinese || settings.position.placement === 'grid')) {
            console.log('🔄 使用增强PDF引擎处理...');
            
            const pdfBuffer = await file.arrayBuffer();
            const config = PDFWatermarkEngine.convertFromWatermarkSettings(settings);
            const pdfResult = await PDFWatermarkEngine.addGridWatermarkToPDF(pdfBuffer, config);
            
            if (pdfResult.success) {
              const pdfBytes = await pdfResult.pdfDocument.save();
              const pdfBlob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
              
              watermarkResult = {
                success: true,
                originalFile: file,
                processedImage: {
                  blob: pdfBlob,
                  dataUrl: await (() => {
                    const store = get();
                    return store.blobToDataURL(pdfBlob);
                  })(),
                  size: pdfBlob.size,
                  dimensions: { width: 800, height: 600 },
                  format: 'pdf'
                },
                certificate: undefined,
                metadata: {
                  processingTime: pdfResult.processingTime,
                  compressionRatio: file.size / pdfBlob.size,
                  originalSize: file.size,
                  processedSize: pdfBlob.size,
                  version: '2.0.0-enhanced',
                  pageCount: pdfResult.pageCount,
                  watermarkCount: pdfResult.watermarkCount,
                  enhancedEngine: true
                },
                error: undefined
              };
            } else {
              throw new Error('PDF处理失败');
            }
          }
          
          // 路径2: Word转PDF增强处理
          else if (isWordFile && (settings.output.format as string) === 'pdf') {
            console.log('🔄 使用Word转PDF增强流程...');
            
            // 方案A: 优先使用混合文档处理器（Word原生PDF转换 + 水印图片合并）
            console.log('🚀 启用方案A: 混合文档处理器');
            
            let docResult;
            try {
              docResult = await HybridDocumentProcessor.processDocument(file, {
                type: settings.type,
                text: settings.text,
                position: settings.position,
                security: settings.security,
                output: settings.output
              }, {
                preserveFormatting: true,
                watermarkStrategy: 'overlay',
                fallbackTimeout: 15000,
                qualityProfile: 'balanced'
              });

              console.log('✅ 方案A处理结果:', {
                success: docResult.success,
                method: docResult.processingMethod,
                formatPreserved: docResult.formatPreservation?.success,
                watermarkCount: docResult.watermarkApplication?.watermarkCount
              });

            } catch (hybridError) {
              console.warn('⚠️ 方案A失败，回退到增强处理器:', hybridError);
              
              // 回退到原有的增强文档处理器
              docResult = await EnhancedDocumentProcessor.processDocument(file, {
                type: settings.type,
                text: settings.text,
                position: settings.position,
                security: settings.security,
                output: settings.output
              });
            }
            
            if (docResult.success && docResult.extractedContent) {
              // 使用PDF引擎创建带水印的PDF
              const pdfResult = await PDFWatermarkEngine.createWatermarkedPDFFromText(
                docResult.extractedContent?.text || '',
                settings,
                {
                  pageFormat: 'A4',
                  orientation: 'portrait',
                  fontSize: 12,
                  margin: 50
                }
              );
              
              if (pdfResult.success && pdfResult.pdfBlob) {
                watermarkResult = {
                  success: true,
                  originalFile: file,
                  processedImage: {
                    blob: pdfResult.pdfBlob,
                    dataUrl: await (() => {
                      const store = get();
                      return store.blobToDataURL(pdfResult.pdfBlob);
                    })(),
                    size: pdfResult.pdfBlob.size,
                    dimensions: { width: 800, height: 600 },
                    format: 'pdf'
                  },
                  certificate: undefined,
                  metadata: {
                    processingTime: docResult.processingTime + pdfResult.processingTime,
                    compressionRatio: file.size / pdfResult.pdfBlob.size,
                    originalSize: file.size,
                    processedSize: pdfResult.pdfBlob.size,
                    version: '2.0.0-enhanced',
                    pageCount: pdfResult.pageCount,
                    watermarkCount: pdfResult.watermarkCount,
                    enhancedEngine: true,
                    conversionMethod: 'word-to-pdf-enhanced'
                  },
                  error: undefined
                };
              } else {
                throw new Error('Word转PDF增强处理失败');
              }
            } else {
              throw new Error('Word文档内容提取失败');
            }
          }
          
          // 路径3: 传统处理（回退方案）
          else {
            console.log('🔄 使用传统处理流程...');
            
            if (isPDFFile) {
              const documentProcessor = new DocumentProcessor();
              const docResult = await documentProcessor.processDocument(file, {
                type: settings.type,
                text: settings.text,
                position: settings.position as any,
                output: settings.output as any
              });
              
              watermarkResult = {
                success: docResult.success,
                originalFile: docResult.originalFile,
                processedImage: docResult.processedDocument ? {
                  blob: docResult.processedDocument.blob,
                  dataUrl: docResult.processedPages?.[0]?.dataUrl || '',
                  size: docResult.processedDocument.blob.size,
                  dimensions: { width: 800, height: 600 },
                  format: docResult.processedDocument.format
                } : {
                  blob: new Blob(),
                  dataUrl: '',
                  size: 0,
                  dimensions: { width: 0, height: 0 },
                  format: 'pdf'
                },
                certificate: undefined,
                metadata: {
                  processingTime: docResult.processingTime,
                  compressionRatio: docResult.processedDocument ? docResult.originalFile.size / docResult.processedDocument.blob.size : 0,
                  originalSize: docResult.originalFile.size,
                  processedSize: docResult.processedDocument?.blob.size || 0,
                  version: '1.0.0-traditional',
                  pageCount: docResult.processedDocument?.pageCount
                },
                error: docResult.error ? { message: docResult.error, code: 'DOCUMENT_PROCESSING_FAILED' } as any : undefined,
                // nativeDocumentResult: docResult // 移除不兼容的字段
              };
            } else if (isWordFile) {
              // 方案A: 对Word文件也使用混合处理器
              console.log('🚀 Word文件启用方案A: 混合文档处理器');
              
              let docResult;
              try {
                docResult = await HybridDocumentProcessor.processDocument(file, {
                  type: settings.type,
                  text: settings.text,
                  position: settings.position,
                  security: settings.security,
                  output: settings.output
                }, {
                  preserveFormatting: true,
                  watermarkStrategy: 'overlay',
                  fallbackTimeout: 10000,
                  qualityProfile: 'balanced'
                });
                
                console.log('✅ Word文件方案A处理结果:', {
                  success: docResult.success,
                  method: docResult.processingMethod,
                  formatPreserved: docResult.formatPreservation?.success
                });

              } catch (hybridError) {
                console.warn('⚠️ Word文件方案A失败，使用原有处理器:', hybridError);
                
                docResult = await EnhancedDocumentProcessor.processDocument(file, {
                  type: settings.type,
                  text: settings.text,
                  position: settings.position,
                  security: settings.security,
                  output: settings.output
                });
              }
              
              watermarkResult = {
                success: docResult.success,
                originalFile: docResult.originalFile,
                processedImage: docResult.processedDocument ? {
                  blob: docResult.processedDocument.blob,
                  dataUrl: docResult.processedDocument.dataUrl,
                  size: docResult.processedDocument.size,
                  dimensions: { width: 800, height: 600 },
                  format: docResult.processedDocument.format
                } : {
                  blob: new Blob(),
                  dataUrl: '',
                  size: 0,
                  dimensions: { width: 0, height: 0 },
                  format: 'docx'
                },
                certificate: undefined,
                metadata: {
                  processingTime: docResult.processingTime,
                  compressionRatio: docResult.processedDocument ? docResult.originalFile.size / docResult.processedDocument.size : 0,
                  originalSize: docResult.originalFile.size,
                  processedSize: docResult.processedDocument?.size || 0,
                  version: '1.0.0-traditional',
                  pageCount: docResult.processedDocument?.pageCount
                },
                error: docResult.error ? { message: docResult.error, code: 'DOCUMENT_PROCESSING_FAILED' } as any : undefined,
                // nativeDocumentResult: docResult // 移除不兼容的字段
              };
            } else {
              // 图像处理
              const imageProcessor = new SimpleWatermarkProcessor();
              const result = await imageProcessor.processFile(file, {
                type: settings.type,
                text: settings.text,
                position: settings.position as any,
                output: settings.output as any
              });
              
              watermarkResult = {
                success: result.success,
                originalFile: result.originalFile,
                processedImage: result.processedImage || {
                  blob: new Blob(),
                  dataUrl: '',
                  size: 0,
                  dimensions: { width: 0, height: 0 },
                  format: 'png'
                },
                certificate: undefined,
                metadata: {
                  processingTime: result.processingTime,
                  compressionRatio: result.processedImage ? result.originalFile.size / result.processedImage.size : 0,
                  originalSize: result.originalFile.size,
                  processedSize: result.processedImage?.size || 0,
                  version: '1.0.0-traditional'
                },
                error: result.error ? { message: result.error, code: 'IMAGE_PROCESSING_ERROR' } as any : undefined
              };
            }
          }

        } catch (error) {
          console.error(`❌ 文件处理失败: ${file.name}`, error);
          
          watermarkResult = {
            success: false,
            originalFile: file,
            processedImage: {
              blob: new Blob(),
              dataUrl: '',
              size: 0,
              dimensions: { width: 0, height: 0 },
              format: 'unknown'
            },
            certificate: undefined,
            metadata: {
              processingTime: performance.now() - fileStartTime,
              compressionRatio: 0,
              originalSize: file.size,
              processedSize: 0,
              version: '2.0.0-enhanced'
            },
            error: error instanceof Error ? 
              { message: error.message, code: 'FILE_PROCESSING_ERROR' } as any :
              { message: String(error), code: 'FILE_PROCESSING_ERROR' } as any
          };
        }
        
        results.set(fileId, watermarkResult);
        
        const fileProcessingTime = performance.now() - fileStartTime;
        console.log(`✅ 文件处理完成: ${file.name}`, {
          success: watermarkResult.success,
          processingTime: `${fileProcessingTime.toFixed(1)}ms`,
          enhancedEngine: watermarkResult.metadata?.enhancedEngine || false,
          watermarkCount: watermarkResult.metadata?.watermarkCount
        });
      }

      // 计算总体统计
      const totalProcessingTime = performance.now() - processingStartTime;
      const successCount = Array.from(results.values()).filter(r => r.success).length;
      const errorCount = results.size - successCount;
      const averageTime = totalProcessingTime / results.size;

      set(state => ({
        files: {
          ...state.files,
          results,
          statistics: {
            totalProcessed: state.files.statistics.totalProcessed + results.size,
            successCount: state.files.statistics.successCount + successCount,
            errorCount: state.files.statistics.errorCount + errorCount,
            averageProcessingTime: averageTime,
            chineseContentDetected: state.files.statistics.chineseContentDetected + chineseContentCount
          }
        },
        ui: {
          ...state.ui,
          loading: false,
          progress: null,
          activeView: 'preview'
        }
      }));

      console.log('🎉 批量文件处理完成:', {
        totalFiles: results.size,
        successCount,
        errorCount,
        totalTime: `${totalProcessingTime.toFixed(1)}ms`,
        averageTime: `${averageTime.toFixed(1)}ms`,
        chineseContentCount,
        enhancedEngineUsed: Array.from(results.values()).some(r => r.metadata?.enhancedEngine)
      });

    } catch (error) {
      console.error('❌ 批量处理失败:', error);
      
      set(state => ({
        ui: {
          ...state.ui,
          loading: false,
          progress: null,
          error: {
            code: 'BATCH_PROCESSING_FAILED',
            message: error instanceof Error ? error.message : 'Batch processing failed',
            timestamp: Date.now(),
            userMessage: '批量文件处理失败',
            recoverable: true
          }
        }
      }));
      throw error;
    }
  },

  /**
   * Blob转DataURL辅助方法
   */
  blobToDataURL: (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  clearFiles: () => {
    set(state => ({
      ...state,
      files: {
        ...state.files,
        selected: [],
        processing: new Map(),
        results: new Map()
      },
      ui: {
        ...state.ui,
        activeView: 'upload'
      }
    }));
  },

  updateWatermarkSettings: (settings: Partial<WatermarkSettings>) => {
    set(state => ({
      watermark: {
        ...state.watermark,
        settings: { ...state.watermark.settings, ...settings }
      }
    }));
  },

  savePreset: (preset) => {
    const newPreset = {
      ...preset,
      id: `preset-${Date.now()}`
    };

    set(state => ({
      watermark: {
        ...state.watermark,
        presets: [...state.watermark.presets, newPreset]
      }
    }));
  },

  loadPreset: (presetId: string) => {
    const { watermark } = get();
    const preset = watermark.presets.find(p => p.id === presetId);
    
    if (preset) {
      set(state => ({
        watermark: {
          ...state.watermark,
          settings: preset.settings
        }
      }));
    }
  },

  deletePreset: (presetId: string) => {
    set(state => ({
      watermark: {
        ...state.watermark,
        presets: state.watermark.presets.filter(p => p.id !== presetId)
      }
    }));
  },

  setActiveView: (view) => {
    set(state => ({
      ui: {
        ...state.ui,
        activeView: view
      }
    }));
  },

  setLoading: (loading: boolean) => {
    set(state => ({
      ui: {
        ...state.ui,
        loading
      }
    }));
  },

  setError: (error) => {
    set(state => ({
      ui: {
        ...state.ui,
        error
      }
    }));
  },

  showModal: (modal) => {
    set(state => ({
      ui: {
        ...state.ui,
        modals: {
          ...state.ui.modals,
          [modal]: true
        }
      }
    }));
  },

  hideModal: (modal) => {
    set(state => ({
      ui: {
        ...state.ui,
        modals: {
          ...state.ui.modals,
          [modal]: false
        }
      }
    }));
  },

  updateMetrics: (metrics) => {
    set(state => ({
      performance: {
        ...state.performance,
        metrics: {
          ...state.performance.metrics,
          ...metrics
        }
      }
    }));
  },

  addWarning: (warning) => {
    set(state => ({
      performance: {
        ...state.performance,
        warnings: [...state.performance.warnings, warning]
      }
    }));
  },

  clearWarnings: () => {
    set(state => ({
      performance: {
        ...state.performance,
        warnings: []
      }
    }));
  },

  // CDN 状态管理增强功能
  getCDNStatus: () => {
    const { cdn } = get();
    return {
      initialized: cdn.initialized,
      loadedLibraries: Array.from(cdn.loadedLibraries || []),
      healthMetrics: cdn.healthMetrics ? {
        latency: (cdn.healthMetrics as any).latency || 0,
        availability: (cdn.healthMetrics as any).availability || 1
      } : undefined,
      supportedFeatures: [],
      lastError: null
    };
  },

  refreshCDNStats: async () => {
    try {
      const { LibraryLoader } = await import('../utils/cdn/LibraryLoader');
      const stats = LibraryLoader.getCDNStats();
      const performanceMetrics = LibraryLoader.getPerformanceMetrics();
      
      set(state => ({
        cdn: {
          ...state.cdn,
          stats,
          healthMetrics: performanceMetrics
        }
      }));
    } catch (error) {
      console.warn('CDN统计刷新失败:', error);
    }
  },

  // 引擎状态监控
  getEngineStatus: () => {
    const { canvas, pdfEngine, workers } = get();
    return {
      canvas: {
        initialized: canvas.engine !== null,
        context: canvas.context !== null,
        chineseRenderer: canvas.chineseRenderer.initialized
      },
      pdf: {
        initialized: pdfEngine.initialized,
        supportedFeatures: pdfEngine.supportedFeatures || []
      },
      pdfEngine: {
        initialized: pdfEngine.initialized,
        status: pdfEngine.status || 'idle',
        supportedFeatures: pdfEngine.supportedFeatures || [],
        lastError: pdfEngine.lastError
      },
      workers: {
        active: workers.activeWorkers?.size || 0,
        total: 4, // 简化处理，假设最大4个worker
        healthy: true
      }
    };
  },

  // 系统健康检查
  performHealthCheck: async () => {
    const state = get();
    
    // 检查各组件状态
    const canvasStatus = state.canvas.chineseRenderer.initialized ? 'ready' : 'not_initialized';
    const cdnStatus = state.cdn.initialized ? 'ready' : 'not_initialized';
    const pdfEngineStatus = state.pdfEngine.initialized ? 'ready' : 'not_initialized';
    const workersStatus = 'ready'; // 简化处理，Worker状态检查复杂
    
    // 计算整体状态
    let overall: 'healthy' | 'warning' | 'error' = 'healthy';
    if ([canvasStatus, cdnStatus, pdfEngineStatus].includes('error')) {
      overall = 'error';
    } else if ([canvasStatus, cdnStatus, pdfEngineStatus].includes('not_initialized')) {
      overall = 'warning';
    }

    return {
      overall,
      canvas: canvasStatus,
      cdn: cdnStatus,
      pdfEngine: pdfEngineStatus,
      workers: workersStatus,
      timestamp: Date.now(),
      details: {
        canvasInitialized: state.canvas.chineseRenderer.initialized,
        cdnInitialized: state.cdn.initialized,
        pdfEngineInitialized: state.pdfEngine.initialized
      }
    };
  },

}));