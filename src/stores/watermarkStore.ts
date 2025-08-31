/**
 * 水印应用状态管理
 * 使用 Zustand 实现轻量级状态管理
 * 基于架构文档的状态管理设计
 */

import { create } from 'zustand';
import type { WatermarkStore } from '@/types/app.types';
import type { WatermarkSettings, WatermarkResult } from '@/types/watermark.types';
import { SimpleWatermarkProcessor } from '@/utils/watermark/SimpleWatermarkProcessor';
import { DocumentProcessor } from '@/utils/document/DocumentProcessor';
import { NativeDocumentProcessor } from '@/utils/document/NativeDocumentProcessor';

export const useWatermarkStore = create<WatermarkStore>((set, get) => ({
  // Canvas 渲染引擎状态
  canvas: {
    engine: null,
    context: null,
    pool: null as any,
    activeCanvases: new Set()
  },

  // WebWorker 并行处理状态
  workers: {
    pool: null as any,
    activeWorkers: new Map(),
    taskQueue: []
  },

  // 文件处理状态
  files: {
    selected: [],
    processing: new Map(),
    results: new Map()
  },

  // 水印设置状态
  watermark: {
    processor: null,
    settings: {
      type: 'text',
      text: {
        content: 'WATERMARK',
        font: {
          family: 'Arial',
          size: 24,
          weight: 'normal',
          style: 'normal'
        },
        color: '#FFFFFF'
      },
      position: {
        placement: 'corner',
        corner: 'bottom-right',
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        opacity: 0.7,
        scale: 1.0,
        rotation: 0,
        blendMode: 'normal'
      },
      security: {
        generateCertificate: true,
        hashAlgorithm: 'SHA-256',
        embedMetadata: true,
        tamperProtection: true
      },
      output: {
        format: 'png',
        quality: 0.9,
        preserveOriginalMetadata: false,
        compression: {
          enabled: true,
          level: 'medium'
        }
      }
    } as WatermarkSettings,
    presets: []
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

  // Actions
  initializeCanvas: async () => {
    const { canvas } = get();
    if (canvas.engine) return;

    try {
      set(state => ({
        ui: { ...state.ui, loading: true, error: null }
      }));

      // 这里应该初始化 Canvas 引擎
      // 简化实现
      console.log('Canvas engine initialized');

      set(state => ({
        ui: { ...state.ui, loading: false }
      }));
    } catch (error) {
      set(state => ({
        ui: {
          ...state.ui,
          loading: false,
          error: {
            code: 'CANVAS_INIT_FAILED',
            message: error instanceof Error ? error.message : 'Canvas initialization failed',
            timestamp: Date.now(),
            userMessage: 'Canvas 引擎初始化失败',
            recoverable: true
          }
        }
      }));
    }
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

  processFiles: async (settings: WatermarkSettings) => {
    const { files } = get();
    
    if (files.selected.length === 0) {
      throw new Error('No files selected');
    }

    set(state => ({
      ui: {
        ...state.ui,
        loading: true,
        progress: { current: 0, total: files.selected.length, message: '开始处理...' }
      }
    }));

    try {
      const imageProcessor = new SimpleWatermarkProcessor();
      const documentProcessor = new DocumentProcessor();
      const nativeDocumentProcessor = new NativeDocumentProcessor();

      const results = new Map<string, WatermarkResult>();

      for (let i = 0; i < files.selected.length; i++) {
        const file = files.selected[i];
        const fileId = `${file.name}-${file.size}`;

        set(state => ({
          ui: {
            ...state.ui,
            progress: {
              current: i,
              total: files.selected.length,
              message: `处理文件: ${file.name}`
            }
          }
        }));

        // 转换设置格式
        const simpleSettings = {
          type: settings.type,
          text: settings.text,
          position: settings.position,
          output: settings.output
        };

        // 判断文件类型并选择合适的处理器
        const isDocument = file.type === 'application/pdf' || 
                          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                          file.type === 'application/msword' ||
                          file.name.toLowerCase().endsWith('.pdf') ||
                          file.name.toLowerCase().endsWith('.docx') ||
                          file.name.toLowerCase().endsWith('.doc');

        const isWordFile = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                          file.type === 'application/msword' ||
                          file.name.toLowerCase().endsWith('.docx') ||
                          file.name.toLowerCase().endsWith('.doc');

        // 检查是否需要Word转PDF
        const needsWordToPdfConversion = isWordFile && settings.output.format === 'word-to-pdf';

        let result;
        let watermarkResult: WatermarkResult;

        if (isDocument && !needsWordToPdfConversion) {
          // 使用原生文档处理器，保持原始格式
          const docResult = await nativeDocumentProcessor.processDocument(file, simpleSettings);
          
          // 转换原生文档处理结果格式
          watermarkResult = {
            success: docResult.success,
            originalFile: docResult.originalFile,
            processedImage: docResult.processedDocument ? {
              blob: docResult.processedDocument.blob,
              dataUrl: docResult.processedDocument.dataUrl,
              size: docResult.processedDocument.size,
              dimensions: { 
                width: 800, // 文档默认尺寸
                height: 600
              },
              format: docResult.processedDocument.format
            } : {
              blob: new Blob(),
              dataUrl: '',
              size: 0,
              dimensions: { width: 0, height: 0 },
              format: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'
            },
            certificate: null,
            metadata: {
              processingTime: docResult.processingTime,
              compressionRatio: docResult.processedDocument ? docResult.originalFile.size / docResult.processedDocument.size : 0,
              originalSize: docResult.originalFile.size,
              processedSize: docResult.processedDocument?.size || 0,
              version: '1.0.0',
              pageCount: docResult.processedDocument?.pageCount
            },
            error: docResult.error ? new Error(docResult.error) : null,
            nativeDocumentResult: docResult // 保存完整的原生文档处理结果
          };
        } else if (needsWordToPdfConversion) {
          // Word转PDF流程：先用文档处理器转换，然后转为PDF
          const docResult = await nativeDocumentProcessor.processWordToPDF(file, simpleSettings);
          
          // 转换Word转PDF结果格式
          watermarkResult = {
            success: docResult.success,
            originalFile: docResult.originalFile,
            processedImage: docResult.processedDocument ? {
              blob: docResult.processedDocument.blob,
              dataUrl: docResult.processedDocument.dataUrl,
              size: docResult.processedDocument.size,
              dimensions: { 
                width: 800, // PDF默认尺寸
                height: 600
              },
              format: 'pdf' // 强制为PDF格式
            } : {
              blob: new Blob(),
              dataUrl: '',
              size: 0,
              dimensions: { width: 0, height: 0 },
              format: 'pdf'
            },
            certificate: null,
            metadata: {
              processingTime: docResult.processingTime,
              compressionRatio: docResult.processedDocument ? docResult.originalFile.size / docResult.processedDocument.size : 0,
              originalSize: docResult.originalFile.size,
              processedSize: docResult.processedDocument?.size || 0,
              version: '1.0.0',
              pageCount: docResult.processedDocument?.pageCount
            },
            error: docResult.error ? new Error(docResult.error) : null,
            nativeDocumentResult: docResult
          };
        } else {
          // 使用图像处理器
          result = await imageProcessor.processFile(file, simpleSettings);
          
          // 转换图像处理结果格式
          watermarkResult = {
            success: result.success,
            originalFile: result.originalFile,
            processedImage: result.processedImage ? {
              blob: result.processedImage.blob,
              dataUrl: result.processedImage.dataUrl,
              size: result.processedImage.size,
              dimensions: result.processedImage.dimensions,
              format: result.processedImage.format
            } : {
              blob: new Blob(),
              dataUrl: '',
              size: 0,
              dimensions: { width: 0, height: 0 },
              format: 'png'
            },
            certificate: null,
            metadata: {
              processingTime: result.processingTime,
              compressionRatio: result.processedImage ? result.originalFile.size / result.processedImage.size : 0,
              originalSize: result.originalFile.size,
              processedSize: result.processedImage?.size || 0,
              version: '1.0.0'
            },
            error: result.error ? new Error(result.error) : null
          };
        }
        
        results.set(fileId, watermarkResult);
      }

      set(state => ({
        files: {
          ...state.files,
          results
        },
        ui: {
          ...state.ui,
          loading: false,
          progress: null,
          activeView: 'preview'
        }
      }));
    } catch (error) {
      set(state => ({
        ui: {
          ...state.ui,
          loading: false,
          progress: null,
          error: {
            code: 'PROCESSING_FAILED',
            message: error instanceof Error ? error.message : 'Processing failed',
            timestamp: Date.now(),
            userMessage: '文件处理失败',
            recoverable: true
          }
        }
      }));
      throw error;
    }
  },

  clearFiles: () => {
    set(state => ({
      files: {
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
  }
}));