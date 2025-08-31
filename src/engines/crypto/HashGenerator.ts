/**
 * 哈希生成器
 * 提供各种哈希算法的统一接口
 * 基于架构文档的安全设计
 */

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'MD5-EMULATION';

export interface HashOptions {
  algorithm: HashAlgorithm;
  outputFormat: 'hex' | 'base64' | 'uint8array';
  chunkSize?: number;
}

export class HashGenerator {
  private static readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB

  /**
   * 计算数据的哈希值
   */
  static async hash(data: ArrayBuffer | Uint8Array | string, options: Partial<HashOptions> = {}): Promise<string | Uint8Array> {
    const config: HashOptions = {
      algorithm: 'SHA-256',
      outputFormat: 'hex',
      ...options
    };

    let buffer: ArrayBuffer;

    if (typeof data === 'string') {
      buffer = new TextEncoder().encode(data).buffer;
    } else if (data instanceof Uint8Array) {
      buffer = data.buffer.slice() as ArrayBuffer; // 确保类型为ArrayBuffer
    } else {
      buffer = data;
    }

    const hashBuffer = await this._calculateHash(buffer, config.algorithm);
    return this._formatOutput(hashBuffer, config.outputFormat);
  }

  /**
   * 计算文件的哈希值
   */
  static async hashFile(file: File, options: Partial<HashOptions> = {}): Promise<string | Uint8Array> {
    const config: HashOptions = {
      algorithm: 'SHA-256',
      outputFormat: 'hex',
      chunkSize: this.DEFAULT_CHUNK_SIZE,
      ...options
    };

    if (file.size <= config.chunkSize!) {
      // 小文件直接处理
      const buffer = await file.arrayBuffer();
      return this.hash(buffer, config);
    } else {
      // 大文件分块处理
      return this._hashLargeFile(file, config);
    }
  }

  /**
   * 计算图像数据的感知哈希
   */
  static async perceptualHash(imageData: ImageData, size: number = 8): Promise<string> {
    // 简化的感知哈希算法实现
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Cannot create canvas context for perceptual hashing');
    }

    // 缩放到指定尺寸
    const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const sourceCtx = sourceCanvas.getContext('2d');
    
    if (!sourceCtx) {
      throw new Error('Cannot create source canvas context');
    }

    sourceCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(sourceCanvas, 0, 0, size, size);

    // 转换为灰度
    const resizedData = ctx.getImageData(0, 0, size, size);
    const pixels = resizedData.data;
    const grayscale = new Array(size * size);

    for (let i = 0; i < grayscale.length; i++) {
      const pixelIndex = i * 4;
      grayscale[i] = Math.round(
        pixels[pixelIndex] * 0.299 +     // R
        pixels[pixelIndex + 1] * 0.587 + // G
        pixels[pixelIndex + 2] * 0.114   // B
      );
    }

    // 计算平均值
    const average = grayscale.reduce((sum, pixel) => sum + pixel, 0) / grayscale.length;

    // 生成哈希位
    let hash = '';
    for (let i = 0; i < grayscale.length; i++) {
      hash += grayscale[i] >= average ? '1' : '0';
    }

    // 转换为十六进制
    return parseInt(hash, 2).toString(16).padStart(Math.ceil(hash.length / 4), '0');
  }

  /**
   * 比较两个哈希的相似度（汉明距离）
   */
  static calculateSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error('Hash lengths must be equal for similarity comparison');
    }

    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }

    return 1 - (differences / hash1.length);
  }

  /**
   * 验证哈希值格式
   */
  static validateHash(hash: string, algorithm: HashAlgorithm): boolean {
    const expectedLengths: Record<HashAlgorithm, number> = {
      'SHA-1': 40,
      'SHA-256': 64,
      'SHA-384': 96,
      'SHA-512': 128,
      'MD5-EMULATION': 32
    };

    const expectedLength = expectedLengths[algorithm];
    
    // 检查长度
    if (hash.length !== expectedLength) {
      return false;
    }

    // 检查是否为有效的十六进制字符串
    return /^[a-fA-F0-9]+$/.test(hash);
  }

  /**
   * 生成安全的随机盐值
   */
  static generateSalt(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    return Array.from(array)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * HMAC 计算
   */
  static async hmac(data: string | ArrayBuffer, key: string, algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'): Promise<string> {
    const encoder = new TextEncoder();
    
    const keyBuffer = encoder.encode(key);
    const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    
    return Array.from(new Uint8Array(signature))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private static async _calculateHash(buffer: ArrayBuffer, algorithm: HashAlgorithm): Promise<ArrayBuffer> {
    switch (algorithm) {
      case 'SHA-1':
      case 'SHA-256':
      case 'SHA-384':
      case 'SHA-512':
        return crypto.subtle.digest(algorithm, buffer);
      
      case 'MD5-EMULATION':
        // MD5 模拟（使用 SHA-256 的截断版本，仅用于兼容性）
        const sha256 = await crypto.subtle.digest('SHA-256', buffer);
        return sha256.slice(0, 16); // 截断到 128 位
      
      default:
        throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
  }

  private static _formatOutput(hashBuffer: ArrayBuffer, format: 'hex' | 'base64' | 'uint8array'): string | Uint8Array {
    const uint8Array = new Uint8Array(hashBuffer);
    
    switch (format) {
      case 'hex':
        return Array.from(uint8Array)
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join('');
      
      case 'base64':
        return btoa(String.fromCharCode(...uint8Array));
      
      case 'uint8array':
        return uint8Array;
      
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  private static async _hashLargeFile(file: File, config: HashOptions): Promise<string | Uint8Array> {
    // 对于大文件，使用流式处理
    const chunkSize = config.chunkSize!;
    const chunks: ArrayBuffer[] = [];
    
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const chunk = file.slice(offset, offset + chunkSize);
      const chunkBuffer = await chunk.arrayBuffer();
      chunks.push(chunkBuffer);
    }

    // 合并所有块
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedBuffer = new ArrayBuffer(totalLength);
    const combinedView = new Uint8Array(combinedBuffer);
    
    let offset = 0;
    for (const chunk of chunks) {
      combinedView.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    const hashBuffer = await this._calculateHash(combinedBuffer, config.algorithm);
    return this._formatOutput(hashBuffer, config.outputFormat);
  }
}