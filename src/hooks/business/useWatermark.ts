/**
 * 水印处理 Hook
 * 管理水印处理流程和状态
 * 基于架构文档的业务 Hook 设计
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  WatermarkSettings,
  WatermarkResult,
  ValidationResult,
  WatermarkProcessor as IWatermarkProcessor
} from '@/types/watermark.types';
import { WatermarkProcessor } from '@/utils/watermark/WatermarkProcessor';

export interface UseWatermarkOptions {
  autoInitialize?: boolean;
  onProcessStart?: (file: File) => void;
  onProcessComplete?: (result: WatermarkResult) => void;
  onProcessError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export interface UseWatermarkReturn {
  processor: IWatermarkProcessor | null;
  isInitialized: boolean;
  isProcessing: boolean;
  isValidating: boolean;
  progress: number;
  currentResult: WatermarkResult | null;
  error: Error | null;
  initialize: () => Promise<void>;
  process: (file: File, settings: WatermarkSettings) => Promise<WatermarkResult>;
  validate: (result: WatermarkResult) => Promise<ValidationResult>;
  reset: () => void;
  dispose: () => void;
}

export function useWatermark(options: UseWatermarkOptions = {}): UseWatermarkReturn {
  const {
    autoInitialize = false,
    onProcessStart,
    onProcessComplete,
    onProcessError,
    onProgress: _onProgress
  } = options;

  const processorRef = useRef<WatermarkProcessor | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentResult, setCurrentResult] = useState<WatermarkResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    if (processorRef.current || isInitialized) {
      return;
    }

    try {
      setError(null);
      const processor = new WatermarkProcessor();
      await processor.initialize();
      
      processorRef.current = processor;
      setIsInitialized(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Watermark processor initialization failed');
      setError(error);
      throw error;
    }
  }, [isInitialized]);

  const process = useCallback(async (
    file: File,
    settings: WatermarkSettings
  ): Promise<WatermarkResult> => {
    if (!processorRef.current) {
      throw new Error('Watermark processor not initialized');
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    
    onProcessStart?.(file);

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) {
            return prev + Math.random() * 10;
          }
          return prev;
        });
      }, 200);

      const result = await processorRef.current.process(file, settings);
      
      clearInterval(progressInterval);
      setProgress(100);
      setCurrentResult(result);

      onProcessComplete?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Watermark processing failed');
      setError(error);
      onProcessError?.(error);
      throw error;
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 1000); // 重置进度条
    }
  }, [onProcessStart, onProcessComplete, onProcessError]);

  const validate = useCallback(async (result: WatermarkResult): Promise<ValidationResult> => {
    if (!processorRef.current) {
      throw new Error('Watermark processor not initialized');
    }

    setIsValidating(true);
    setError(null);

    try {
      const validation = await processorRef.current.validate(result);
      return validation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Validation failed');
      setError(error);
      throw error;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setIsValidating(false);
    setProgress(0);
    setCurrentResult(null);
    setError(null);
  }, []);

  const dispose = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.dispose();
      processorRef.current = null;
    }
    setIsInitialized(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (autoInitialize && !isInitialized) {
      initialize();
    }
  }, [autoInitialize, isInitialized, initialize]);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    processor: processorRef.current,
    isInitialized,
    isProcessing,
    isValidating,
    progress,
    currentResult,
    error,
    initialize,
    process,
    validate,
    reset,
    dispose
  };
}