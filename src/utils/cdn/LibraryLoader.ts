/**
 * CDN库动态加载器
 * 核心功能：单库加载、多CDN备用、依赖管理、并发优化、错误恢复
 * 基于用户提供的技术方案实现
 */

import type { 
  CDNLibrary, 
  LibraryLoadResult, 
  LoadingProgress, 
  CDNError,
  LibraryLoadOptions,
  CDNMonitorStats
} from '../../types/cdn.types';
import { getCDNLibraryConfig, getDependencyChain, DEFAULT_CDN_CONFIG } from './CDNConfig';

export class LibraryLoader {
  private static loadedLibraries = new Set<string>();
  private static loadingPromises = new Map<string, Promise<LibraryLoadResult>>();
  private static loadingProgress = new Map<string, LoadingProgress>();
  private static cdnStats: CDNMonitorStats = {};
  private static performanceMetrics = {
    totalLoadsAttempted: 0,
    totalLoadsSucceeded: 0,
    averageLoadTime: 0,
    loadTimes: [] as number[]
  };

  /**
   * 加载单个库
   * 核心功能：重复加载跳过、全局变量验证、性能监控
   */
  static async loadLibrary(
    libraryName: string, 
    options: LibraryLoadOptions = {}
  ): Promise<LibraryLoadResult> {
    const startTime = performance.now();
    
    // 检查是否已加载
    if (this.isLibraryLoaded(libraryName)) {
      return {
        success: true,
        library: libraryName,
        loadTime: 0,
        method: 'cache'
      };
    }

    // 检查是否正在加载（并发去重）
    if (this.loadingPromises.has(libraryName)) {
      return await this.loadingPromises.get(libraryName)!;
    }

    const library = getCDNLibraryConfig(libraryName);
    if (!library) {
      throw new Error(`Unknown library: ${libraryName}`);
    }

    // 检查依赖
    await this.loadDependencies(libraryName);

    // 创建加载Promise并缓存
    const loadPromise = this.executeLibraryLoad(library, options, startTime);
    this.loadingPromises.set(libraryName, loadPromise);

    try {
      const result = await loadPromise;
      
      if (result.success) {
        this.loadedLibraries.add(libraryName);
        this.updatePerformanceMetrics(result.loadTime);
      }

      return result;
    } finally {
      this.loadingPromises.delete(libraryName);
      this.loadingProgress.delete(libraryName);
    }
  }

  /**
   * 批量加载多个库
   * 支持并发优化和依赖顺序管理
   */
  static async loadLibraries(libraryNames: string[]): Promise<LibraryLoadResult[]> {
    const allDependencies = new Set<string>();
    
    // 收集所有依赖
    for (const name of libraryNames) {
      const deps = getDependencyChain(name);
      deps.forEach(dep => allDependencies.add(dep));
    }

    const sortedLibraries = Array.from(allDependencies).sort((a, b) => {
      const libA = getCDNLibraryConfig(a);
      const libB = getCDNLibraryConfig(b);
      return (libA?.priority || 999) - (libB?.priority || 999);
    });

    // 限制并发数量
    const maxConcurrent = DEFAULT_CDN_CONFIG.maxConcurrentLoads;
    const results: LibraryLoadResult[] = [];
    
    for (let i = 0; i < sortedLibraries.length; i += maxConcurrent) {
      const batch = sortedLibraries.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(name => this.loadLibrary(name));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 执行实际的库加载
   */
  private static async executeLibraryLoad(
    library: CDNLibrary,
    options: LibraryLoadOptions,
    startTime: number
  ): Promise<LibraryLoadResult> {
    const timeout = options.timeout || library.timeout;
    const maxRetries = options.retryAttempts || library.retryAttempts || DEFAULT_CDN_CONFIG.retryAttempts;
    
    // 初始化加载进度
    this.updateLoadingProgress(library.name, {
      library: library.name,
      status: 'loading',
      progress: 0,
      attempt: 1,
      startTime
    });

    let lastError: Error | null = null;
    
    // 尝试每个CDN URL
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (let urlIndex = 0; urlIndex < library.urls.length; urlIndex++) {
        const url = library.urls[urlIndex];
        
        this.updateLoadingProgress(library.name, {
          library: library.name,
          status: 'loading',
          progress: ((attempt * library.urls.length + urlIndex) / (maxRetries * library.urls.length)) * 80,
          currentUrl: url,
          attempt: attempt + 1,
          startTime
        });

        try {
          await this.loadScriptFromUrl(url, timeout);
          
          // 验证全局变量是否正确注册
          if (!this.validateGlobalVariable(library.globalName)) {
            throw new Error(`Global variable ${library.globalName} not found after loading`);
          }

          const loadTime = performance.now() - startTime;
          
          // 更新CDN统计
          this.updateCDNStats(url, true, loadTime);
          
          this.updateLoadingProgress(library.name, {
            library: library.name,
            status: 'loaded',
            progress: 100,
            currentUrl: url,
            attempt: attempt + 1,
            startTime
          });

          return {
            success: true,
            library: library.name,
            loadTime,
            cdnUrl: url,
            method: 'network'
          };

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.updateCDNStats(url, false, performance.now() - startTime);
          
          // 如果不是最后一次尝试，继续
          if (attempt < maxRetries - 1 || urlIndex < library.urls.length - 1) {
            await this.sleep(DEFAULT_CDN_CONFIG.retryDelay * (attempt + 1)); // 指数退避
          }
        }
      }
    }

    // 所有CDN都失败了
    this.updateLoadingProgress(library.name, {
      library: library.name,
      status: 'failed',
      progress: 100,
      attempt: maxRetries,
      startTime
    });

    const cdnError: CDNError = new Error(`Failed to load ${library.name} from all CDN sources`) as CDNError;
    cdnError.code = 'ALL_CDNS_FAILED';
    cdnError.library = library.name;
    cdnError.originalError = lastError || undefined;

    return {
      success: false,
      library: library.name,
      loadTime: performance.now() - startTime,
      error: cdnError.message,
      method: 'network'
    };
  }

  /**
   * 从指定URL加载脚本
   */
  private static loadScriptFromUrl(url: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;

      // 设置超时
      const timeoutId = setTimeout(() => {
        script.remove();
        reject(new Error(`Script loading timeout: ${url}`));
      }, timeout);

      script.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        script.remove();
        reject(new Error(`Script loading failed: ${url}`));
      };

      script.src = url;
      document.head.appendChild(script);
    });
  }

  /**
   * 加载依赖库
   */
  private static async loadDependencies(libraryName: string): Promise<void> {
    const library = getCDNLibraryConfig(libraryName);
    if (!library?.dependencies) return;

    for (const dep of library.dependencies) {
      if (!this.isLibraryLoaded(dep)) {
        await this.loadLibrary(dep);
      }
    }
  }

  /**
   * 验证全局变量是否正确注册
   */
  private static validateGlobalVariable(globalName: string): boolean {
    const parts = globalName.split('.');
    let obj: any = window;
    
    for (const part of parts) {
      if (obj[part] === undefined) {
        return false;
      }
      obj = obj[part];
    }
    
    return true;
  }

  /**
   * 检查库是否已加载
   */
  static isLibraryLoaded(libraryName: string): boolean {
    if (this.loadedLibraries.has(libraryName)) {
      const library = getCDNLibraryConfig(libraryName);
      if (library) {
        return this.validateGlobalVariable(library.globalName);
      }
    }
    return false;
  }

  /**
   * 检查库是否正在加载
   */
  static isLoading(libraryName: string): boolean {
    return this.loadingPromises.has(libraryName);
  }

  /**
   * 获取加载进度
   */
  static getLoadingProgress(libraryName?: string): LoadingProgress[] {
    if (libraryName) {
      const progress = this.loadingProgress.get(libraryName);
      return progress ? [progress] : [];
    }
    return Array.from(this.loadingProgress.values());
  }

  /**
   * 更新加载进度
   */
  private static updateLoadingProgress(libraryName: string, progress: Partial<LoadingProgress>): void {
    const current = this.loadingProgress.get(libraryName);
    this.loadingProgress.set(libraryName, {
      library: libraryName,
      status: 'pending',
      progress: 0,
      attempt: 1,
      startTime: Date.now(),
      ...current,
      ...progress
    });
  }

  /**
   * 更新CDN统计信息
   */
  private static updateCDNStats(url: string, success: boolean, responseTime: number): void {
    if (!this.cdnStats[url]) {
      this.cdnStats[url] = {
        successRate: 0,
        averageResponseTime: 0,
        lastSuccessTime: 0,
        failureCount: 0,
        totalRequests: 0
      };
    }

    const stats = this.cdnStats[url];
    stats.totalRequests++;

    if (success) {
      stats.lastSuccessTime = Date.now();
      stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
    } else {
      stats.failureCount++;
    }

    stats.successRate = (stats.totalRequests - stats.failureCount) / stats.totalRequests;
  }

  /**
   * 获取CDN健康度统计
   */
  static getCDNStats(): CDNMonitorStats {
    return { ...this.cdnStats };
  }

  /**
   * 获取性能指标
   */
  static getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * 更新性能指标
   */
  private static updatePerformanceMetrics(loadTime: number): void {
    this.performanceMetrics.totalLoadsAttempted++;
    this.performanceMetrics.totalLoadsSucceeded++;
    this.performanceMetrics.loadTimes.push(loadTime);
    
    // 保持最近100次的加载时间记录
    if (this.performanceMetrics.loadTimes.length > 100) {
      this.performanceMetrics.loadTimes.shift();
    }
    
    this.performanceMetrics.averageLoadTime = 
      this.performanceMetrics.loadTimes.reduce((sum, time) => sum + time, 0) / 
      this.performanceMetrics.loadTimes.length;
  }

  /**
   * 重置状态（用于测试）
   */
  static reset(): void {
    this.loadedLibraries.clear();
    this.loadingPromises.clear();
    this.loadingProgress.clear();
    this.cdnStats = {};
    this.performanceMetrics = {
      totalLoadsAttempted: 0,
      totalLoadsSucceeded: 0,
      averageLoadTime: 0,
      loadTimes: []
    };
  }

  /**
   * 获取推荐的CDN（基于健康度统计）
   */
  static getRecommendedCDN(libraryName: string): string | null {
    const library = getCDNLibraryConfig(libraryName);
    if (!library) return null;

    let bestUrl = library.urls[0];
    let bestScore = 0;

    for (const url of library.urls) {
      const stats = this.cdnStats[url];
      if (stats) {
        // 综合评分：成功率权重0.7，响应时间权重0.3
        const responseTimeScore = Math.max(0, 1 - stats.averageResponseTime / 10000); // 10秒为基准
        const score = stats.successRate * 0.7 + responseTimeScore * 0.3;
        
        if (score > bestScore) {
          bestScore = score;
          bestUrl = url;
        }
      }
    }

    return bestUrl;
  }

  /**
   * 工具方法：延迟执行
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}