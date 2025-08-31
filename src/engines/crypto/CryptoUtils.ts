/**
 * 加密工具类
 * 提供各种加密相关的实用函数
 * 基于架构文档的安全设计
 */

export class CryptoUtils {
  /**
   * 生成安全的随机数据
   */
  static generateRandomBytes(length: number): Uint8Array {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  }

  /**
   * 生成随机 UUID
   */
  static generateUUID(): string {
    // 使用 Crypto API 生成真正的随机 UUID v4
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    
    // 设置版本位 (4) 和变体位
    array[6] = (array[6] & 0x0f) | 0x40; // 版本 4
    array[8] = (array[8] & 0x3f) | 0x80; // 变体位
    
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }

  /**
   * 时间安全的字符串比较
   */
  static constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * 安全地清除敏感数据
   */
  static secureWipe(data: Uint8Array | ArrayBuffer): void {
    if (data instanceof ArrayBuffer) {
      const view = new Uint8Array(data);
      crypto.getRandomValues(view); // 用随机数据覆盖
      view.fill(0); // 再用零覆盖
    } else {
      crypto.getRandomValues(data);
      data.fill(0);
    }
  }

  /**
   * 密码强度检查
   */
  static checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
    isStrong: boolean;
  } {
    const feedback: string[] = [];
    let score = 0;

    // 长度检查
    if (password.length >= 12) {
      score += 2;
    } else if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('密码应至少包含8个字符');
    }

    // 字符类型检查
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('应包含小写字母');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('应包含大写字母');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('应包含数字');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('应包含特殊字符');

    // 复杂性检查
    if (password.length >= 16 && /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9])/.test(password)) {
      score += 1;
    }

    // 常见模式检查
    const commonPatterns = [
      /123/g, /abc/g, /qwer/g, /asdf/g,
      /(.)\1{2,}/g // 重复字符
    ];

    let hasCommonPatterns = false;
    for (const pattern of commonPatterns) {
      if (pattern.test(password.toLowerCase())) {
        hasCommonPatterns = true;
        break;
      }
    }

    if (hasCommonPatterns) {
      score -= 1;
      feedback.push('避免使用常见模式或重复字符');
    }

    return {
      score: Math.max(0, score),
      feedback,
      isStrong: score >= 5 && feedback.length === 0
    };
  }

  /**
   * Base64 编码（URL 安全版本）
   */
  static base64UrlEncode(data: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Base64 解码（URL 安全版本）
   */
  static base64UrlDecode(encoded: string): Uint8Array {
    // 还原标准 Base64 格式
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    
    // 补充填充
    while (base64.length % 4) {
      base64 += '=';
    }

    const decoded = atob(base64);
    return new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
  }

  /**
   * 计算熵值（随机性度量）
   */
  static calculateEntropy(data: string): number {
    const frequencies: Record<string, number> = {};
    
    // 统计字符频率
    for (const char of data) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    // 计算熵值
    const length = data.length;
    let entropy = 0;

    for (const count of Object.values(frequencies)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * 密钥派生函数 (PBKDF2)
   */
  static async deriveKey(
    password: string,
    salt: string,
    iterations: number = 100000,
    keyLength: number = 32
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);

    // 导入密码作为密钥材料
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey', 'deriveBits']
    );

    // 派生密钥
    return crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      keyLength * 8 // 位数
    );
  }

  /**
   * AES-GCM 加密
   */
  static async encrypt(
    data: string | ArrayBuffer,
    key: ArrayBuffer,
    additionalData?: ArrayBuffer
  ): Promise<{
    encrypted: ArrayBuffer;
    iv: ArrayBuffer;
    tag: ArrayBuffer;
  }> {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM 推荐 12 字节 IV
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const dataBuffer = typeof data === 'string' 
      ? new TextEncoder().encode(data) 
      : data;

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData
      },
      cryptoKey,
      dataBuffer
    );

    // AES-GCM 返回密文 + 认证标签
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const tag = encryptedArray.slice(-16);

    return {
      encrypted: ciphertext.buffer,
      iv: iv.buffer,
      tag: tag.buffer
    };
  }

  /**
   * AES-GCM 解密
   */
  static async decrypt(
    encrypted: ArrayBuffer,
    key: ArrayBuffer,
    iv: ArrayBuffer,
    tag: ArrayBuffer,
    additionalData?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 合并密文和标签
    const combined = new Uint8Array(encrypted.byteLength + tag.byteLength);
    combined.set(new Uint8Array(encrypted));
    combined.set(new Uint8Array(tag), encrypted.byteLength);

    return crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData
      },
      cryptoKey,
      combined
    );
  }

  /**
   * 安全地生成验证码
   */
  static generateSecureCode(length: number = 6, charset: string = '0123456789'): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(length));
    let code = '';
    
    for (let i = 0; i < length; i++) {
      code += charset[randomBytes[i] % charset.length];
    }
    
    return code;
  }

  /**
   * 检查数据完整性
   */
  static async verifyIntegrity(
    data: ArrayBuffer,
    expectedHash: string,
    algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'
  ): Promise<boolean> {
    const actualHashBuffer = await crypto.subtle.digest(algorithm, data);
    const actualHash = Array.from(new Uint8Array(actualHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return this.constantTimeEquals(actualHash, expectedHash);
  }

  /**
   * 生成数字指纹
   */
  static async generateFingerprint(data: any[]): Promise<string> {
    const normalizedData = JSON.stringify(data, Object.keys(data).sort());
    const buffer = new TextEncoder().encode(normalizedData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16); // 取前16位作为指纹
  }
}