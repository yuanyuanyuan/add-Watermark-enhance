/**
 * WebWorker Hook
 * 管理 WebWorker 池和任务处理
 * 基于架构文档的 Hook 设计
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { ProcessingTask, TaskResult, WorkerPool as IWorkerPool } from '@/types/worker.types';
import { WorkerPool } from '@/workers/WorkerPool';

export interface UseWebWorkerOptions {
  maxWorkers?: number;
  autoInitialize?: boolean;
  onTaskComplete?: (result: TaskResult) => void;
  onTaskError?: (taskId: string, error: Error) => void;
  onProgress?: (taskId: string, progress: number) => void;
}

export interface UseWebWorkerReturn {
  pool: IWorkerPool | null;
  isInitialized: boolean;
  stats: any;
  activeTaskIds: Set<string>;
  execute: <T = any>(task: ProcessingTask) => Promise<TaskResult>;
  terminate: () => void;
  getHealth: () => any;
}

export function useWebWorker(options: UseWebWorkerOptions = {}): UseWebWorkerReturn {
  const {
    maxWorkers = navigator.hardwareConcurrency || 4,
    autoInitialize = true,
    onTaskComplete,
    onTaskError,
    onProgress
  } = options;

  const poolRef = useRef<WorkerPool | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeTaskIds, setActiveTaskIds] = useState<Set<string>>(new Set());

  const initialize = useCallback(() => {
    if (poolRef.current) {
      return;
    }

    try {
      const pool = new WorkerPool(maxWorkers);
      poolRef.current = pool;
      setIsInitialized(true);
      setStats(pool.stats);
    } catch (error) {
      console.error('Failed to initialize worker pool:', error);
    }
  }, [maxWorkers]);

  const execute = useCallback(async <T = any>(task: ProcessingTask): Promise<TaskResult> => {
    if (!poolRef.current) {
      throw new Error('Worker pool not initialized');
    }

    const taskId = task.id;
    
    // 添加任务到活跃列表
    setActiveTaskIds(prev => new Set(prev).add(taskId));

    // 包装任务以添加进度回调
    const wrappedTask: ProcessingTask = {
      ...task,
      onProgress: (progress: number) => {
        onProgress?.(taskId, progress);
        task.onProgress?.(progress);
      }
    };

    try {
      const result = await poolRef.current.execute<T>(wrappedTask);
      
      // 更新统计信息
      if (poolRef.current) {
        setStats(poolRef.current.stats);
      }

      onTaskComplete?.(result);
      return result;
    } catch (error) {
      const taskError = error instanceof Error ? error : new Error('Task execution failed');
      onTaskError?.(taskId, taskError);
      throw taskError;
    } finally {
      // 从活跃列表中移除任务
      setActiveTaskIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  }, [onTaskComplete, onTaskError, onProgress]);

  const terminate = useCallback(() => {
    if (poolRef.current) {
      poolRef.current.terminate();
      poolRef.current = null;
    }
    setIsInitialized(false);
    setStats(null);
    setActiveTaskIds(new Set());
  }, []);

  const getHealth = useCallback(() => {
    return poolRef.current?.getHealthStatus() || null;
  }, []);

  useEffect(() => {
    if (autoInitialize && !isInitialized) {
      initialize();
    }
  }, [autoInitialize, isInitialized, initialize]);

  useEffect(() => {
    // 定期更新统计信息
    const interval = setInterval(() => {
      if (poolRef.current) {
        setStats(poolRef.current.stats);
      }
    }, 1000); // 每秒更新

    return () => clearInterval(interval);
  }, [isInitialized]);

  useEffect(() => {
    return () => {
      terminate();
    };
  }, [terminate]);

  return {
    pool: poolRef.current,
    isInitialized,
    stats,
    activeTaskIds,
    execute,
    terminate,
    getHealth
  };
}