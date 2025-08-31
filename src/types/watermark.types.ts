/**
 * 水印处理相关类型定义
 * 基于架构文档的水印功能设计
 */

import type { CanvasErrorInfo } from './canvas.types';
import type { CertificateData } from './worker.types';

export interface WatermarkProcessor {
  process(image: File, config: WatermarkSettings): Promise<WatermarkResult>;
  validate(result: WatermarkResult): Promise<ValidationResult>;
  generateCertificate(result: WatermarkResult): Promise<CertificateData>;
}

export interface WatermarkSettings {
  type: 'text' | 'image' | 'hybrid';
  text?: TextWatermarkConfig;
  image?: ImageWatermarkConfig;
  position: WatermarkLayoutConfig;
  security: SecurityConfig;
  output: OutputConfig;
}

export interface TextWatermarkConfig {
  content: string;
  font: FontConfig;
  color: string | ColorConfig;
  outline?: OutlineConfig;
  shadow?: ShadowConfig;
}

export interface ColorConfig {
  type: 'solid' | 'gradient' | 'multi';
  primary: string;
  secondary?: string;
  gradient?: {
    type: 'linear' | 'radial';
    stops: Array<{ offset: number; color: string; }>;
    angle?: number; // for linear gradient
    centerX?: number; // for radial gradient  
    centerY?: number; // for radial gradient
    radius?: number; // for radial gradient
  };
  multi?: string[]; // for multi-color patterns
}

export interface FontConfig {
  family: string;
  size: number;
  weight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  style: 'normal' | 'italic' | 'oblique';
}

export interface OutlineConfig {
  width: number;
  color: string;
}

export interface ShadowConfig {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface ImageWatermarkConfig {
  source: File | Blob | ImageData;
  tint?: string;
  preserveAspectRatio: boolean;
}

export interface WatermarkLayoutConfig {
  placement: 'corner' | 'center' | 'edge' | 'pattern' | 'custom' | 'grid';
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  edge?: 'top' | 'right' | 'bottom' | 'left';
  pattern?: PatternConfig;
  custom?: CustomPositionConfig;
  grid?: GridConfig;
  margin: MarginConfig;
  opacity: number; // 0.0 - 1.0
  scale: number; // 0.1 - 2.0
  rotation: number; // degrees
  blendMode: GlobalCompositeOperation;
}

export interface GridConfig {
  spacingX: number; // horizontal spacing between watermarks
  spacingY: number; // vertical spacing between watermarks
  stagger?: boolean; // whether to stagger alternate rows
  layers?: number; // number of layers (default 1)
  densityMode?: 'low' | 'normal' | 'high'; // density of watermarks
}

export interface PatternConfig {
  type?: 'default' | 'tiled-3-column' | 'random';
  spacing: { x: number; y: number };
  offset?: { x: number; y: number };
  stagger?: boolean;
  // For tiled-3-column pattern
  columns?: number;
  rows?: number;
  // For random pattern
  randomSeed?: number;
  density?: number; // 0.1 - 1.0, percentage of area to fill
  avoidOverlap?: boolean;
}

export interface CustomPositionConfig {
  x: number | string; // pixels or percentage
  y: number | string; // pixels or percentage
}

export interface MarginConfig {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SecurityConfig {
  generateCertificate: boolean;
  hashAlgorithm: 'SHA-256' | 'SHA-512';
  embedMetadata: boolean;
  tamperProtection: boolean;
  // Chinese character validation
  blockChineseCharacters: boolean;
  allowedLanguages?: ('en' | 'zh' | 'ja' | 'ko' | 'all')[];
}

export interface OutputConfig {
  format: 'png' | 'jpeg' | 'webp';
  quality: number; // 0.1 - 1.0
  maxFileSize?: number; // bytes
  preserveOriginalMetadata: boolean;
  compression: CompressionConfig;
}

export interface CompressionConfig {
  enabled: boolean;
  level: 'low' | 'medium' | 'high' | 'maximum';
  progressive?: boolean; // for JPEG
  lossless?: boolean; // for WebP
}

export interface WatermarkResult {
  success: boolean;
  originalFile: File;
  processedImage: ProcessedImageData;
  certificate?: CertificateData;
  metadata: ProcessingMetadata;
  error?: CanvasErrorInfo;
}

export interface ProcessedImageData {
  blob: Blob;
  dataUrl: string;
  dimensions: { width: number; height: number };
  format: string;
  size: number; // bytes
}

export interface ProcessingMetadata {
  processingTime: number; // milliseconds
  memoryPeak?: number; // bytes
  compressionRatio: number;
  qualityScore?: number; // 0.0 - 1.0
  watermarkCount?: number;
  settings?: WatermarkSettings;
  timestamp?: number;
  pageCount?: number; // 用于文档处理
  originalSize?: number; // 原始文件大小
  processedSize?: number; // 处理后文件大小
  version?: string; // 处理器版本
  enhancedEngine?: boolean; // 是否使用增强引擎
  conversionMethod?: string; // 转换方法
}

export interface ValidationResult {
  isValid: boolean;
  certificate?: CertificateData;
  tamperDetected: boolean;
  confidence: number; // 0.0 - 1.0
  validationTime: number; // milliseconds
  errors?: string[];
}

export type WatermarkError = 
  | 'INVALID_INPUT_IMAGE'
  | 'WATERMARK_TOO_LARGE'
  | 'PROCESSING_FAILED'
  | 'CERTIFICATE_GENERATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'OUTPUT_SIZE_EXCEEDED';

export interface WatermarkErrorInfo {
  code: WatermarkError;
  message: string;
  context?: Record<string, unknown>;
  watermarkConfig?: Partial<WatermarkSettings>;
}