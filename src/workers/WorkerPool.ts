/**
 * WebWorker 池管理器
 * 实现高效的并行任务处理
 * 基于架构文档的 WebWorker 设计
 */

import type {
  WorkerPool as IWorkerPool,
  ProcessingTask,
  TaskResult,
  WorkerMessage,
  WorkerTask,
  TaskPriority
} from '@/types/worker.types';

interface WorkerInfo {
  id: string;
  worker: Worker;
  busy: boolean;
  currentTask: string | null;
  taskCount: number;
  lastActivity: number;
}

export class WorkerPool implements IWorkerPool {
  private readonly _workers = new Map<string, WorkerInfo>();
  private readonly _taskQueue: ProcessingTask[] = [];
  private readonly _activeTasks = new Map<string, WorkerTask>();
  private readonly _pendingPromises = new Map<string, {
    resolve: (result: TaskResult) => void;
    reject: (error: Error) => void;
  }>();
  private readonly _maxWorkers: number;
  private readonly _workerScript: string;
  private _nextWorkerId = 0;
  private _isTerminated = false;

  constructor(maxWorkers = navigator.hardwareConcurrency || 4, workerScript = '/src/workers/watermark-processor.worker.js') {
    this._maxWorkers = Math.min(maxWorkers, 8); // 限制最大 Worker 数量
    this._workerScript = workerScript;
  }

  get workers(): Map<string, Worker> {
    const result = new Map<string, Worker>();
    for (const [id, info] of this._workers) {
      result.set(id, info.worker);
    }
    return result;
  }

  get activeWorkers(): Set<string> {
    const result = new Set<string>();
    for (const [id, info] of this._workers) {
      if (info.busy) {
        result.add(id);
      }
    }
    return result;
  }

  get taskQueue(): ProcessingTask[] {
    return [...this._taskQueue];
  }

  get maxWorkers(): number {
    return this._maxWorkers;
  }

  get stats() {
    return {
      totalWorkers: this._workers.size,
      activeWorkers: this.activeWorkers.size,
      queuedTasks: this._taskQueue.length,
      activeTasks: this._activeTasks.size,
      utilization: this._workers.size > 0 ? this.activeWorkers.size / this._workers.size : 0
    };
  }

  /**
   * 执行任务
   */
  async execute(task: ProcessingTask): Promise<TaskResult> {
    if (this._isTerminated) {
      throw new Error('Worker pool has been terminated');
    }

    // 生成唯一任务 ID
    const taskId = task.id || this._generateTaskId();
    const taskWithId = { ...task, id: taskId };

    return new Promise<TaskResult>((resolve, reject) => {
      // 存储 Promise 回调
      this._pendingPromises.set(taskId, { resolve, reject });

      // 设置超时
      const timeout = task.timeout || 30000; // 30 秒默认超时
      const timeoutId = setTimeout(() => {
        this._handleTaskTimeout(taskId);
      }, timeout);

      // 添加清理逻辑
      const originalResolve = resolve;
      const wrappedResolve = (result: TaskResult) => {
        clearTimeout(timeoutId);
        this._pendingPromises.delete(taskId);
        originalResolve(result);
      };

      const originalReject = reject;
      const wrappedReject = (error: Error) => {
        clearTimeout(timeoutId);
        this._pendingPromises.delete(taskId);
        originalReject(error);
      };

      this._pendingPromises.set(taskId, { 
        resolve: wrappedResolve, 
        reject: wrappedReject 
      });

      // 尝试立即执行或加入队列
      this._scheduleTask(taskWithId);
    });
  }

  /**
   * 终止所有 Worker
   */
  terminate(): void {
    if (this._isTerminated) {
      return;
    }

    this._isTerminated = true;

    // 拒绝所有待处理的任务
    for (const [, { reject }] of this._pendingPromises) {
      reject(new Error('Worker pool terminated'));
    }
    this._pendingPromises.clear();

    // 终止所有 Worker
    for (const [id, info] of this._workers) {
      try {
        info.worker.terminate();
      } catch (error) {
        console.warn(`Failed to terminate worker ${id}:`, error);
      }
    }

    this._workers.clear();
    this._taskQueue.length = 0;
    this._activeTasks.clear();

    console.log('Worker pool terminated');
  }

  /**
   * 获取池的健康状态
   */
  getHealthStatus() {
    const stats = this.stats;
    const avgTasksPerWorker = this._workers.size > 0 
      ? Array.from(this._workers.values()).reduce((sum, info) => sum + info.taskCount, 0) / this._workers.size
      : 0;

    return {
      isHealthy: !this._isTerminated && this._workers.size > 0,
      stats,
      averageTasksPerWorker: avgTasksPerWorker,
      oldestWorker: this._getOldestWorker(),
      recommendation: this._getScalingRecommendation(stats)
    };
  }

  private _scheduleTask(task: ProcessingTask): void {
    // 按优先级插入队列
    const priority = task.priority || 'normal';
    const insertIndex = this._findInsertPosition(priority);
    this._taskQueue.splice(insertIndex, 0, task);

    // 尝试立即执行
    this._processQueue();
  }

  private _findInsertPosition(priority: TaskPriority): number {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const taskPriority = priorityOrder[priority];

    for (let i = 0; i < this._taskQueue.length; i++) {
      const queuePriority = priorityOrder[this._taskQueue[i].priority || 'normal'];
      if (taskPriority < queuePriority) {
        return i;
      }
    }

    return this._taskQueue.length;
  }

  private async _processQueue(): Promise<void> {
    if (this._taskQueue.length === 0) {
      return;
    }

    // 寻找可用的 Worker
    let availableWorker = this._findAvailableWorker();

    // 如果没有可用 Worker 且未达到最大数量，创建新 Worker
    if (!availableWorker && this._workers.size < this._maxWorkers) {
      availableWorker = await this._createWorker();
    }

    if (availableWorker) {
      const task = this._taskQueue.shift()!;
      await this._executeTask(availableWorker, task);
    }
  }

  private _findAvailableWorker(): WorkerInfo | null {
    for (const info of this._workers.values()) {
      if (!info.busy) {
        return info;
      }
    }
    return null;
  }

  private async _createWorker(): Promise<WorkerInfo | null> {
    const workerId = `worker-${this._nextWorkerId++}`;
    
    try {
      const worker = new Worker(this._workerScript, { 
        type: 'module',
        name: workerId 
      });

      const workerInfo: WorkerInfo = {
        id: workerId,
        worker,
        busy: false,
        currentTask: null,
        taskCount: 0,
        lastActivity: Date.now()
      };

      // 设置消息处理器
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this._handleWorkerMessage(workerId, event.data);
      };

      worker.onerror = (error) => {
        this._handleWorkerError(workerId, error);
      };

      this._workers.set(workerId, workerInfo);
      
      console.log(`Created worker: ${workerId}`);
      return workerInfo;
    } catch (error) {
      console.error(`Failed to create worker: ${workerId}`, error);
      return null;
    }
  }

  private async _executeTask(workerInfo: WorkerInfo, task: ProcessingTask): Promise<void> {
    const workerTask: WorkerTask = {
      ...task,
      workerId: workerInfo.id,
      startTime: Date.now()
    };

    // 更新 Worker 状态
    workerInfo.busy = true;
    workerInfo.currentTask = task.id;
    workerInfo.taskCount++;
    workerInfo.lastActivity = Date.now();

    // 存储活跃任务
    this._activeTasks.set(task.id, workerTask);

    // 发送任务给 Worker
    const message: WorkerMessage = {
      type: 'task',
      taskId: task.id,
      data: task,
      timestamp: Date.now()
    };

    workerInfo.worker.postMessage(message);
  }

  private _handleWorkerMessage(workerId: string, message: WorkerMessage): void {
    const workerInfo = this._workers.get(workerId);
    if (!workerInfo) {
      console.warn(`Received message from unknown worker: ${workerId}`);
      return;
    }

    switch (message.type) {
      case 'result':
        this._handleTaskResult(workerId, message);
        break;
      case 'progress':
        this._handleTaskProgress(workerId, message);
        break;
      case 'error':
        this._handleTaskError(workerId, message);
        break;
      default:
        console.warn(`Unknown message type from worker ${workerId}:`, message.type);
    }
  }

  private _handleTaskResult(workerId: string, message: WorkerMessage): void {
    const workerInfo = this._workers.get(workerId)!;
    const taskId = message.taskId;
    const result = message.data as TaskResult;

    // 更新 Worker 状态
    workerInfo.busy = false;
    workerInfo.currentTask = null;
    workerInfo.lastActivity = Date.now();

    // 清理任务记录
    this._activeTasks.delete(taskId);

    // 解决 Promise
    const promise = this._pendingPromises.get(taskId);
    if (promise) {
      promise.resolve(result);
    }

    // 处理下一个任务
    this._processQueue();
  }

  private _handleTaskProgress(_workerId: string, message: WorkerMessage): void {
    const taskId = message.taskId;
    const progress = message.data as number;
    
    const task = this._activeTasks.get(taskId);
    if (task && task.onProgress) {
      task.onProgress(progress);
    }
  }

  private _handleTaskError(workerId: string, message: WorkerMessage): void {
    const workerInfo = this._workers.get(workerId)!;
    const taskId = message.taskId;
    const errorData = message.data;

    // 更新 Worker 状态
    workerInfo.busy = false;
    workerInfo.currentTask = null;
    workerInfo.lastActivity = Date.now();

    // 清理任务记录
    this._activeTasks.delete(taskId);

    // 拒绝 Promise
    const promise = this._pendingPromises.get(taskId);
    if (promise) {
      const errorMessage = (errorData && typeof errorData === 'object' && 'message' in errorData) ? 
        (errorData as any).message : 'Worker task failed';
      promise.reject(new Error(errorMessage));
    }

    // 处理下一个任务
    this._processQueue();
  }

  private _handleWorkerError(workerId: string, error: ErrorEvent): void {
    console.error(`Worker ${workerId} error:`, error);
    
    const workerInfo = this._workers.get(workerId);
    if (workerInfo && workerInfo.currentTask) {
      // 处理当前任务的失败
      this._handleTaskError(workerId, {
        type: 'error',
        taskId: workerInfo.currentTask,
        data: { message: error.message },
        timestamp: Date.now()
      });
    }
  }

  private _handleTaskTimeout(taskId: string): void {
    const promise = this._pendingPromises.get(taskId);
    if (promise) {
      promise.reject(new Error(`Task ${taskId} timed out`));
    }

    // 查找并终止相关的 Worker 任务
    const task = this._activeTasks.get(taskId);
    if (task) {
      const workerInfo = this._workers.get(task.workerId);
      if (workerInfo) {
        // 重置 Worker 状态
        workerInfo.busy = false;
        workerInfo.currentTask = null;
      }
      this._activeTasks.delete(taskId);
    }
  }

  private _generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _getOldestWorker(): string | null {
    let oldest: WorkerInfo | null = null;
    for (const info of this._workers.values()) {
      if (!oldest || info.lastActivity < oldest.lastActivity) {
        oldest = info;
      }
    }
    return oldest?.id || null;
  }

  private _getScalingRecommendation(stats: any): string {
    if (stats.utilization > 0.9 && stats.queuedTasks > 0) {
      return stats.totalWorkers < this._maxWorkers 
        ? 'Consider scaling up workers'
        : 'Pool at maximum capacity';
    } else if (stats.utilization < 0.3 && stats.totalWorkers > 1) {
      return 'Consider scaling down workers';
    }
    return 'Pool size optimal';
  }
}