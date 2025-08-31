/**
 * 证书系统核心实现
 * SHA-256 证书生成和验证
 * 基于架构文档的安全设计
 */

import type { CertificateData } from '@/types/worker.types';
import type { WatermarkResult, ProcessingMetadata } from '@/types/watermark.types';

export interface CertificateConfig {
  algorithm: 'SHA-256' | 'SHA-512';
  includeTimestamp: boolean;
  includeMetadata: boolean;
  customFields?: Record<string, any>;
}

export class CertificateSystem {
  private readonly _config: CertificateConfig;

  constructor(config: Partial<CertificateConfig> = {}) {
    this._config = {
      algorithm: 'SHA-256',
      includeTimestamp: true,
      includeMetadata: true,
      ...config
    };
  }

  /**
   * 为水印结果生成证书
   */
  async generateCertificate(
    result: WatermarkResult,
    additionalData?: Record<string, any>
  ): Promise<CertificateData> {
    if (!result.success || !result.processedImage.blob) {
      throw new Error('Cannot generate certificate for failed watermark result');
    }

    try {
      // 获取图像数据
      const imageBuffer = await result.processedImage.blob.arrayBuffer();
      
      // 计算图像哈希
      const imageHash = await this._calculateHash(new Uint8Array(imageBuffer));
      
      // 构建证书数据
      const certificateData: any = {
        imageHash,
        imageSize: imageBuffer.byteLength,
        dimensions: result.processedImage.dimensions,
        format: result.processedImage.format
      };

      if (this._config.includeTimestamp) {
        certificateData.timestamp = Date.now();
        certificateData.createdAt = new Date().toISOString();
      }

      if (this._config.includeMetadata && result.metadata) {
        certificateData.metadata = this._sanitizeMetadata(result.metadata);
      }

      if (additionalData) {
        certificateData.additionalData = additionalData;
      }

      if (this._config.customFields) {
        Object.assign(certificateData, this._config.customFields);
      }

      // 生成数字签名
      const signature = await this._generateSignature(certificateData);
      
      // 计算证书哈希
      const certificateHash = await this._calculateHash(
        new TextEncoder().encode(JSON.stringify(certificateData))
      );

      return {
        hash: certificateHash,
        timestamp: certificateData.timestamp || Date.now(),
        signature,
        metadata: {
          ...certificateData,
          algorithm: this._config.algorithm,
          version: '1.0.0'
        }
      };
    } catch (error) {
      throw new Error(`Certificate generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 验证证书的有效性
   */
  async validateCertificate(
    certificate: CertificateData,
    imageBlob: Blob
  ): Promise<{
    isValid: boolean;
    errors: string[];
    details: ValidationDetails;
  }> {
    const errors: string[] = [];
    const details: ValidationDetails = {
      hashValid: false,
      signatureValid: false,
      timestampValid: false,
      metadataValid: false,
      tamperDetected: false,
      confidence: 0
    };

    try {
      // 验证图像哈希
      const currentImageBuffer = await imageBlob.arrayBuffer();
      const currentImageHash = await this._calculateHash(new Uint8Array(currentImageBuffer));
      
      if (certificate.metadata.imageHash === currentImageHash) {
        details.hashValid = true;
      } else {
        details.tamperDetected = true;
        errors.push('Image hash mismatch - content may have been tampered with');
      }

      // 验证数字签名
      try {
        const signatureValid = await this._verifySignature(certificate);
        details.signatureValid = signatureValid;
        
        if (!signatureValid) {
          errors.push('Digital signature verification failed');
        }
      } catch (error) {
        errors.push(`Signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // 验证时间戳
      if (certificate.timestamp) {
        const now = Date.now();
        const age = now - certificate.timestamp;
        
        // 检查证书是否过期（例如1年）
        const maxAge = 365 * 24 * 60 * 60 * 1000; // 1年
        
        if (age > maxAge) {
          errors.push('Certificate has expired');
        } else if (certificate.timestamp > now + 60000) { // 允许1分钟时间偏差
          errors.push('Certificate timestamp is in the future');
        } else {
          details.timestampValid = true;
        }
      }

      // 验证元数据完整性
      if (certificate.metadata) {
        details.metadataValid = this._validateMetadata(certificate.metadata);
        
        if (!details.metadataValid) {
          errors.push('Certificate metadata is invalid');
        }
      }

      // 计算置信度
      let validCount = 0;
      let totalChecks = 0;

      [details.hashValid, details.signatureValid, details.timestampValid, details.metadataValid]
        .forEach(valid => {
          if (valid) validCount++;
          totalChecks++;
        });

      details.confidence = totalChecks > 0 ? validCount / totalChecks : 0;

      const isValid = errors.length === 0 && details.confidence >= 0.75;

      return {
        isValid,
        errors,
        details
      };
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        isValid: false,
        errors,
        details
      };
    }
  }

  /**
   * 生成证书指纹
   */
  async generateFingerprint(certificate: CertificateData): Promise<string> {
    const fingerprintData = {
      hash: certificate.hash,
      timestamp: certificate.timestamp,
      signature: certificate.signature
    };

    const buffer = new TextEncoder().encode(JSON.stringify(fingerprintData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    
    return Array.from(new Uint8Array(hashBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 检查证书链（如果支持）
   */
  async validateCertificateChain(certificates: CertificateData[]): Promise<boolean> {
    if (certificates.length === 0) return false;
    if (certificates.length === 1) return true;

    // 简化的证书链验证
    for (let i = 0; i < certificates.length - 1; i++) {
      const current = certificates[i];
      const next = certificates[i + 1];

      // 检查时间顺序
      if (current.timestamp >= next.timestamp) {
        return false;
      }

      // 检查哈希链接（简化实现）
      if (!this._isLinked(current, next)) {
        return false;
      }
    }

    return true;
  }

  private async _calculateHash(data: Uint8Array): Promise<string> {
    const algorithm = this._config.algorithm === 'SHA-512' ? 'SHA-512' : 'SHA-256';
    // 确保数据是正确的ArrayBuffer格式
    const buffer = data.buffer instanceof ArrayBuffer 
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : new ArrayBuffer(data.byteLength);
    
    if (!(data.buffer instanceof ArrayBuffer)) {
      const view = new Uint8Array(buffer);
      view.set(data);
    }
    
    const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
    
    return Array.from(new Uint8Array(hashBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async _generateSignature(data: any): Promise<string> {
    const dataString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataString);
    
    // 生成 HMAC 签名（实际应用中应使用更安全的密钥管理）
    const key = await crypto.subtle.generateKey(
      { name: 'HMAC', hash: this._config.algorithm },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, dataBuffer);
    
    return Array.from(new Uint8Array(signatureBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async _verifySignature(certificate: CertificateData): Promise<boolean> {
    try {
      // 重新构建签名数据
      const signatureData = { ...certificate.metadata };
      delete signatureData.signature; // 移除签名字段
      
      const expectedSignature = await this._generateSignature(signatureData);
      return expectedSignature === certificate.signature;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  private _sanitizeMetadata(metadata: ProcessingMetadata): Record<string, any> {
    return {
      processingTime: metadata.processingTime,
      compressionRatio: metadata.compressionRatio,
      qualityScore: metadata.qualityScore,
      watermarkCount: metadata.watermarkCount,
      timestamp: metadata.timestamp,
      // 排除敏感信息
      settings: metadata.settings ? {
        type: metadata.settings.type,
        position: metadata.settings.position?.placement,
        opacity: metadata.settings.position?.opacity,
        // 不包含具体的文本内容或图像数据
      } : undefined
    };
  }

  private _validateMetadata(metadata: any): boolean {
    // 检查必需字段
    const requiredFields = ['algorithm', 'version', 'imageHash'];
    
    for (const field of requiredFields) {
      if (!(field in metadata)) {
        return false;
      }
    }

    // 检查算法支持
    if (!['SHA-256', 'SHA-512'].includes(metadata.algorithm)) {
      return false;
    }

    // 检查版本格式
    if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      return false;
    }

    return true;
  }

  private _isLinked(current: CertificateData, next: CertificateData): boolean {
    // 简化的链接检查：下一个证书的某些字段应该引用当前证书
    return next.metadata.previousHash === current.hash;
  }
}

interface ValidationDetails {
  hashValid: boolean;
  signatureValid: boolean;
  timestampValid: boolean;
  metadataValid: boolean;
  tamperDetected: boolean;
  confidence: number;
}