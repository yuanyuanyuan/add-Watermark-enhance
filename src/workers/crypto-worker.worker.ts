/**
 * 加密处理 WebWorker
 * 处理 SHA-256 证书生成和验证
 * 基于架构文档的安全设计
 */

import type {
  WorkerMessage,
  ProcessingTask,
  TaskResult,
  CertificateData,
  ProcessingMetrics
} from '@/types/worker.types';

declare const self: DedicatedWorkerGlobalScope;

class CryptoProcessor {
  private _isProcessing = false;
  private _currentTaskId: string | null = null;

  /**
   * 获取当前任务ID
   */
  public getCurrentTaskId(): string | null {
    return this._currentTaskId;
  }

  constructor() {
    self.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.handleMessage(event.data);
    };

    console.log('Crypto processor worker initialized');
  }

  private async handleMessage(message: WorkerMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'task':
          await this.processTask(message.taskId, message.data as ProcessingTask);
          break;
        default:
          this.sendError(message.taskId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(message.taskId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async processTask(taskId: string, task: ProcessingTask): Promise<void> {
    if (this._isProcessing) {
      this.sendError(taskId, 'Crypto worker is already processing a task');
      return;
    }

    this._isProcessing = true;
    this._currentTaskId = taskId;

    const startTime = performance.now();

    try {
      let result: any;

      switch (task.type) {
        case 'generate-certificate':
          result = await this.generateCertificate(taskId, task);
          break;
        case 'validate-certificate':
          result = await this.validateCertificate(taskId, task);
          break;
        case 'hash-generate':
          result = await this.generateHash(taskId, task);
          break;
        case 'hash-generate':
          result = await this.signData(taskId, task);
          break;
        default:
          throw new Error(`Unsupported crypto operation: ${task.type}`);
      }

      const metrics: ProcessingMetrics = {
        processingTime: performance.now() - startTime,
        memoryUsage: 0, // Crypto operations don't use much memory
        operationCount: 1
      };

      this.sendResult(taskId, {
        taskId,
        success: true,
        data: result,
        metrics
      });
    } catch (error) {
      this.sendError(taskId, error instanceof Error ? error.message : 'Crypto processing failed');
    } finally {
      this._isProcessing = false;
      this._currentTaskId = null;
    }
  }

  private async generateCertificate(taskId: string, task: ProcessingTask): Promise<CertificateData> {
    const { imageData, metadata } = task.data;
    
    if (!imageData) {
      throw new Error('Missing image data for certificate generation');
    }

    this.sendProgress(taskId, 0.2);

    // 生成图像哈希
    const imageHash = await this.calculateImageHash(imageData.data);
    
    this.sendProgress(taskId, 0.5);

    // 生成时间戳
    const timestamp = Date.now();
    
    // 创建证书数据
    const certificateData = {
      imageHash,
      timestamp,
      metadata: metadata || {},
      version: '1.0'
    };

    this.sendProgress(taskId, 0.7);

    // 生成数字签名
    const signature = await this.generateSignature(certificateData);
    
    this.sendProgress(taskId, 1.0);

    return {
      hash: imageHash,
      timestamp,
      signature,
      metadata: certificateData.metadata
    };
  }

  private async validateCertificate(taskId: string, task: ProcessingTask): Promise<any> {
    const { certificate, imageData } = task.data;
    
    if (!certificate || !imageData) {
      throw new Error('Missing certificate or image data');
    }

    this.sendProgress(taskId, 0.3);

    // 重新计算图像哈希
    const currentHash = await this.calculateImageHash(imageData.data);
    
    this.sendProgress(taskId, 0.6);

    // 验证哈希匹配
    const hashValid = currentHash === certificate.hash;
    
    // 验证签名
    const signatureValid = await this.verifySignature(certificate);
    
    this.sendProgress(taskId, 1.0);

    return {
      isValid: hashValid && signatureValid,
      hashValid,
      signatureValid,
      tamperDetected: !hashValid,
      validationTime: Date.now() - certificate.timestamp
    };
  }

  private async generateHash(taskId: string, task: ProcessingTask): Promise<string> {
    const { data, algorithm } = task.data;
    
    if (!data) {
      throw new Error('Missing data for hash generation');
    }

    this.sendProgress(taskId, 0.3);

    const hash = await this.calculateHash(data, algorithm || 'SHA-256');
    
    this.sendProgress(taskId, 1.0);

    return hash;
  }

  private async signData(taskId: string, task: ProcessingTask): Promise<string> {
    const { data } = task.data;
    
    if (!data) {
      throw new Error('Missing data for signing');
    }

    this.sendProgress(taskId, 0.5);

    const signature = await this.generateSignature(data);
    
    this.sendProgress(taskId, 1.0);

    return signature;
  }

  private async calculateImageHash(imageData: Uint8ClampedArray): Promise<string> {
    // 使用 Web Crypto API 计算 SHA-256
    const uint8Array = new Uint8Array(imageData);
    const buffer = await crypto.subtle.digest('SHA-256', uint8Array);
    return this.arrayBufferToHex(buffer);
  }

  private async calculateHash(data: any, algorithm: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);
    
    const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
    return this.arrayBufferToHex(hashBuffer);
  }

  private async generateSignature(data: any): Promise<string> {
    // 简化的签名生成（实际应用中应使用私钥）
    const dataString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataString);
    
    // 生成 HMAC-SHA256 签名
    const key = await crypto.subtle.generateKey(
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);
    return this.arrayBufferToHex(signature);
  }

  private async verifySignature(certificate: CertificateData): Promise<boolean> {
    // 简化的签名验证
    try {
      const dataToVerify = {
        hash: certificate.hash,
        timestamp: certificate.timestamp,
        metadata: certificate.metadata
      };
      
      // 重新生成签名进行比较
      const expectedSignature = await this.generateSignature(dataToVerify);
      return expectedSignature === certificate.signature;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const byteArray = new Uint8Array(buffer);
    return Array.from(byteArray)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private sendResult(taskId: string, result: TaskResult): void {
    const message: WorkerMessage = {
      type: 'result',
      taskId,
      data: result,
      timestamp: Date.now()
    };
    
    self.postMessage(message);
  }

  private sendProgress(taskId: string, progress: number): void {
    const message: WorkerMessage = {
      type: 'progress',
      taskId,
      data: progress,
      timestamp: Date.now()
    };
    
    self.postMessage(message);
  }

  private sendError(taskId: string, errorMessage: string): void {
    const message: WorkerMessage = {
      type: 'error',
      taskId,
      data: { message: errorMessage },
      timestamp: Date.now()
    };
    
    self.postMessage(message);
  }
}

// 初始化 Worker
new CryptoProcessor();