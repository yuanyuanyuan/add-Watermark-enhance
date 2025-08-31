/**
 * Canvas Hook
 * 管理 Canvas 渲染引擎和相关状态
 * 基于架构文档的 Hook 设计
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { CanvasRenderingEngine, RenderOperation, RenderResult } from '@/types/canvas.types';
import { CanvasRenderer } from '@/engines/canvas/CanvasRenderer';

export interface UseCanvasOptions {
  autoInitialize?: boolean;
  enableMetrics?: boolean;
  onError?: (error: Error) => void;
  onRenderComplete?: (result: RenderResult) => void;
}

export interface UseCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  renderer: CanvasRenderingEngine | null;
  isInitialized: boolean;
  isRendering: boolean;
  metrics: any;
  error: Error | null;
  initialize: () => Promise<void>;
  render: (operation: RenderOperation) => Promise<RenderResult>;
  dispose: () => void;
  reset: () => void;
}

export function useCanvas(options: UseCanvasOptions = {}): UseCanvasReturn {
  const {
    autoInitialize = false,
    enableMetrics = true,
    onError,
    onRenderComplete
  } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    if (!canvasRef.current || isInitialized) {
      return;
    }

    try {
      setError(null);
      const renderer = new CanvasRenderer();
      await renderer.initialize(canvasRef.current);
      
      rendererRef.current = renderer;
      setIsInitialized(true);

      if (enableMetrics) {
        setMetrics(renderer.metrics);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Canvas initialization failed');
      setError(error);
      onError?.(error);
    }
  }, [isInitialized, enableMetrics, onError]);

  const render = useCallback(async (operation: RenderOperation): Promise<RenderResult> => {
    if (!rendererRef.current || !isInitialized) {
      throw new Error('Canvas not initialized');
    }

    setIsRendering(true);
    setError(null);

    try {
      const result = await rendererRef.current.render(operation);
      
      if (enableMetrics) {
        setMetrics(rendererRef.current.metrics);
      }

      onRenderComplete?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Rendering failed');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsRendering(false);
    }
  }, [isInitialized, enableMetrics, onError, onRenderComplete]);

  const dispose = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    setIsInitialized(false);
    setIsRendering(false);
    setMetrics(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    dispose();
    if (autoInitialize) {
      initialize();
    }
  }, [dispose, initialize, autoInitialize]);

  useEffect(() => {
    if (autoInitialize && canvasRef.current && !isInitialized) {
      initialize();
    }
  }, [autoInitialize, initialize, isInitialized]);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    canvasRef,
    renderer: rendererRef.current,
    isInitialized,
    isRendering,
    metrics,
    error,
    initialize,
    render,
    dispose,
    reset
  };
}