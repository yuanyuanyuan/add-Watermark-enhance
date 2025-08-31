/**
 * CDN库配置管理
 * 定义所有外部库的CDN地址、依赖关系、超时设置等
 */

import type { CDNLibrary, CDNConfig } from '../../types/cdn.types';

export const DEFAULT_CDN_CONFIG: CDNConfig = {
  retryAttempts: 3,
  retryDelay: 1000,
  defaultTimeout: 10000,
  fallbackEnabled: true,
  enableMonitoring: true,
  maxConcurrentLoads: 3
};

/**
 * 外部库CDN配置清单
 * 优先使用可靠性高的CDN，设置多重备用
 */
export const CDN_LIBRARIES: CDNLibrary[] = [
  {
    name: 'jszip',
    urls: [
      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js',
      'https://cdn.jsdelivr.net/npm/jszip@3.7.1/dist/jszip.min.js',
      'https://unpkg.com/jszip@3.7.1/dist/jszip.min.js'
    ],
    globalName: 'JSZip',
    timeout: 10000,
    retryAttempts: 3,
    priority: 1
  },
  {
    name: 'pdf-lib',
    urls: [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
      'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'
    ],
    globalName: 'PDFLib',
    timeout: 15000,
    retryAttempts: 3,
    priority: 2
  },
  {
    name: 'mammoth',
    urls: [
      'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js',
      'https://cdn.jsdelivr.net/npm/mammoth@1.4.2/mammoth.browser.min.js',
      'https://unpkg.com/mammoth@1.4.2/mammoth.browser.min.js'
    ],
    globalName: 'mammoth',
    dependencies: ['jszip'],
    timeout: 12000,
    retryAttempts: 3,
    priority: 3
  },
  {
    name: 'fontkit',
    urls: [
      'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
      'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'
    ],
    globalName: 'fontkit',
    dependencies: ['pdf-lib'],
    timeout: 8000,
    retryAttempts: 2,
    priority: 4
  }
];

/**
 * 根据库名获取CDN配置
 */
export function getCDNLibraryConfig(libraryName: string): CDNLibrary | undefined {
  return CDN_LIBRARIES.find(lib => lib.name === libraryName);
}

/**
 * 获取库的依赖链
 */
export function getDependencyChain(libraryName: string): string[] {
  const library = getCDNLibraryConfig(libraryName);
  if (!library) return [];

  const chain: string[] = [];
  const visited = new Set<string>();

  function resolveDependencies(name: string) {
    if (visited.has(name)) return; // 防止循环依赖
    visited.add(name);

    const lib = getCDNLibraryConfig(name);
    if (lib?.dependencies) {
      for (const dep of lib.dependencies) {
        resolveDependencies(dep);
        if (!chain.includes(dep)) {
          chain.push(dep);
        }
      }
    }
  }

  resolveDependencies(libraryName);
  chain.push(libraryName);
  
  return chain;
}

/**
 * 验证库配置的合法性
 */
export function validateLibraryConfig(library: CDNLibrary): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!library.name) {
    errors.push('Library name is required');
  }

  if (!library.urls || library.urls.length === 0) {
    errors.push('At least one URL is required');
  }

  if (!library.globalName) {
    errors.push('Global name is required');
  }

  if (library.timeout && library.timeout < 1000) {
    errors.push('Timeout should be at least 1000ms');
  }

  // 验证URL格式
  if (library.urls) {
    for (const url of library.urls) {
      try {
        new URL(url);
      } catch {
        errors.push(`Invalid URL: ${url}`);
      }
    }
  }

  // 验证依赖关系
  if (library.dependencies) {
    for (const dep of library.dependencies) {
      if (dep === library.name) {
        errors.push('Library cannot depend on itself');
      }
      if (!getCDNLibraryConfig(dep)) {
        errors.push(`Unknown dependency: ${dep}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检测循环依赖
 */
export function detectCircularDependencies(): { hasCircular: boolean; cycles: string[][] } {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(libraryName: string, path: string[]): void {
    if (visiting.has(libraryName)) {
      // 找到循环依赖
      const cycleStart = path.indexOf(libraryName);
      const cycle = path.slice(cycleStart);
      cycle.push(libraryName);
      cycles.push(cycle);
      return;
    }

    if (visited.has(libraryName)) {
      return;
    }

    visiting.add(libraryName);
    const library = getCDNLibraryConfig(libraryName);
    
    if (library?.dependencies) {
      for (const dep of library.dependencies) {
        dfs(dep, [...path, libraryName]);
      }
    }

    visiting.delete(libraryName);
    visited.add(libraryName);
  }

  for (const library of CDN_LIBRARIES) {
    if (!visited.has(library.name)) {
      dfs(library.name, []);
    }
  }

  return {
    hasCircular: cycles.length > 0,
    cycles
  };
}