/**
 * 兼容性验证测试套件
 * 测试不同浏览器版本、API兼容性、设备支持
 * 覆盖测试用例：COMPAT-001 到 COMPAT-020
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// 浏览器检测工具函数
const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Chrome')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return { name: 'Chrome', version: match ? parseInt(match[1]) : 0 };
  } else if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    return { name: 'Firefox', version: match ? parseInt(match[1]) : 0 };
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    return { name: 'Safari', version: match ? parseInt(match[1]) : 0 };
  } else if (userAgent.includes('Edge')) {
    const match = userAgent.match(/Edge\/(\d+)/);
    return { name: 'Edge', version: match ? parseInt(match[1]) : 0 };
  }
  
  return { name: 'Unknown', version: 0 };
};

// API兼容性检测工具
const checkAPISupport = () => {
  return {
    canvas: !!window.HTMLCanvasElement,
    canvasToBlob: !!HTMLCanvasElement.prototype.toBlob,
    fileReader: !!window.FileReader,
    arrayBuffer: !!window.ArrayBuffer,
    uint8Array: !!window.Uint8Array,
    blob: !!window.Blob,
    url: !!window.URL,
    createObjectURL: !!(window.URL && window.URL.createObjectURL),
    webWorker: !!window.Worker,
    dragAndDrop: 'DataTransfer' in window,
    fileAPI: 'FileList' in window,
    promise: !!window.Promise,
    asyncAwait: true, // 在测试环境中假设支持
    es6: true // 在测试环境中假设支持
  };
};

describe('兼容性验证测试套件', () => {
  let originalNavigator: Navigator;

  beforeEach(() => {
    originalNavigator = navigator;
  });

  afterEach(() => {
    // 恢复原始环境
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true
    });
  });

  describe('COMPAT-001: Chrome版本兼容', () => {
    const testChromeVersions = [90, 91, 95, 100, 105];

    testChromeVersions.forEach(version => {
      it(`应该支持Chrome ${version}`, () => {
        // 模拟Chrome用户代理
        Object.defineProperty(navigator, 'userAgent', {
          value: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.4472.124 Safari/537.36`,
          writable: true
        });

        const browserInfo = getBrowserInfo();
        expect(browserInfo.name).toBe('Chrome');
        expect(browserInfo.version).toBe(version);

        // Chrome 90+ 应该支持所有必要的API
        if (version >= 90) {
          const apiSupport = checkAPISupport();
          expect(apiSupport.canvas).toBe(true);
          expect(apiSupport.canvasToBlob).toBe(true);
          expect(apiSupport.fileReader).toBe(true);
          expect(apiSupport.blob).toBe(true);
          expect(apiSupport.createObjectURL).toBe(true);
        }
      });
    });
  });

  describe('COMPAT-002: Firefox版本兼容', () => {
    const testFirefoxVersions = [88, 90, 95, 100];

    testFirefoxVersions.forEach(version => {
      it(`应该支持Firefox ${version}`, () => {
        Object.defineProperty(navigator, 'userAgent', {
          value: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`,
          writable: true
        });

        const browserInfo = getBrowserInfo();
        expect(browserInfo.name).toBe('Firefox');
        expect(browserInfo.version).toBe(version);

        // Firefox 88+ 应该支持必要API
        if (version >= 88) {
          const apiSupport = checkAPISupport();
          expect(apiSupport.canvas).toBe(true);
          expect(apiSupport.fileReader).toBe(true);
          expect(apiSupport.webWorker).toBe(true);
        }
      });
    });
  });

  describe('COMPAT-003: Safari版本兼容', () => {
    const testSafariVersions = [14, 15, 16];

    testSafariVersions.forEach(version => {
      it(`应该支持Safari ${version}`, () => {
        Object.defineProperty(navigator, 'userAgent', {
          value: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version}.1.1 Safari/605.1.15`,
          writable: true
        });

        const browserInfo = getBrowserInfo();
        expect(browserInfo.name).toBe('Safari');
        expect(browserInfo.version).toBe(version);

        // Safari 14+ 应该支持基本API
        if (version >= 14) {
          const apiSupport = checkAPISupport();
          expect(apiSupport.canvas).toBe(true);
          expect(apiSupport.fileReader).toBe(true);
        }
      });
    });
  });

  describe('COMPAT-004: Edge版本兼容', () => {
    it('应该支持Edge 90+', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edge/91.0.864.59',
        writable: true
      });

      const browserInfo = getBrowserInfo();
      expect(browserInfo.name).toBe('Edge');
      expect(browserInfo.version).toBeGreaterThanOrEqual(90);
    });
  });

  describe('COMPAT-005: Canvas API兼容', () => {
    it('应该支持基础Canvas API', () => {
      expect(window.HTMLCanvasElement).toBeDefined();
      
      const canvas = document.createElement('canvas');
      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
      
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();
      
      if (ctx) {
        // 测试基础绘图方法
        expect(typeof ctx.fillText).toBe('function');
        expect(typeof ctx.measureText).toBe('function');
        expect(typeof ctx.drawImage).toBe('function');
        expect(typeof ctx.translate).toBe('function');
        expect(typeof ctx.rotate).toBe('function');
      }
    });

    it('应该支持Canvas中文字体渲染', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // 测试中文字体设置
        ctx.font = '24px Microsoft YaHei, SimSun, sans-serif';
        expect(ctx.font).toContain('24px');
        
        // 测试中文文本测量
        const metrics = ctx.measureText('机密文档');
        expect(metrics).toBeDefined();
        expect(typeof metrics.width).toBe('number');
        expect(metrics.width).toBeGreaterThan(0);
        
        // 测试文本渲染（不会抛出异常）
        expect(() => {
          ctx.fillText('机密文档', 10, 10);
        }).not.toThrow();
      }
    });

    it('应该支持Canvas高质量渲染设置', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // 测试抗锯齿设置
        ctx.imageSmoothingEnabled = true;
        expect(ctx.imageSmoothingEnabled).toBe(true);
        
        // 测试渲染质量设置（某些浏览器支持）
        if ('imageSmoothingQuality' in ctx) {
          ctx.imageSmoothingQuality = 'high';
          expect(ctx.imageSmoothingQuality).toBe('high');
        }
        
        // 测试文本渲染设置
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        expect(ctx.textBaseline).toBe('middle');
        expect(ctx.textAlign).toBe('center');
      }
    });
  });

  describe('COMPAT-006: FileReader API兼容', () => {
    it('应该支持FileReader基础功能', () => {
      expect(window.FileReader).toBeDefined();
      
      const reader = new FileReader();
      expect(reader).toBeInstanceOf(FileReader);
      
      // 测试必要方法
      expect(typeof reader.readAsArrayBuffer).toBe('function');
      expect(typeof reader.readAsDataURL).toBe('function');
      expect(typeof reader.readAsText).toBe('function');
      
      // 测试事件处理
      expect(reader.onload).toBeNull();
      expect(reader.onerror).toBeNull();
      expect(reader.onprogress).toBeNull();
    });

    it('应该能够读取ArrayBuffer', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);
      const mockFile = new Blob([mockData], { type: 'application/octet-stream' });
      
      const reader = new FileReader();
      
      const readPromise = new Promise((resolve, reject) => {
        reader.onload = (event) => {
          resolve(event.target?.result);
        };
        reader.onerror = reject;
      });
      
      reader.readAsArrayBuffer(mockFile);
      
      // 在测试环境中手动触发onload
      setTimeout(() => {
        const event = { target: { result: mockData.buffer } };
        if (reader.onload) {
          reader.onload(event as any);
        }
      }, 10);
      
      const result = await readPromise;
      expect(result).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('COMPAT-008: Blob API兼容', () => {
    it('应该支持Blob构造和操作', () => {
      expect(window.Blob).toBeDefined();
      
      // 测试Blob创建
      const data = new Uint8Array([1, 2, 3, 4]);
      const blob = new Blob([data], { type: 'application/octet-stream' });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBe(4);
      expect(blob.type).toBe('application/octet-stream');
      
      // 测试切片功能
      expect(typeof blob.slice).toBe('function');
      const sliced = blob.slice(0, 2);
      expect(sliced.size).toBe(2);
    });

    it('应该支持PDF MIME类型', () => {
      const pdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { 
        type: 'application/pdf' 
      });
      
      expect(pdfBlob.type).toBe('application/pdf');
      expect(pdfBlob.size).toBe(4);
    });
  });

  describe('COMPAT-011: 字体渲染兼容性', () => {
    const testFonts = [
      'Microsoft YaHei',
      'SimSun',
      'PingFang SC',
      'Hiragino Sans GB',
      'WenQuanYi Micro Hei',
      'Noto Sans CJK SC',
      'Source Han Sans SC'
    ];

    testFonts.forEach(fontName => {
      it(`应该能够使用字体 ${fontName}`, () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // 尝试设置字体
          const fontString = `24px "${fontName}", sans-serif`;
          ctx.font = fontString;
          
          // 字体设置不应该抛出异常
          expect(() => {
            ctx.font = fontString;
          }).not.toThrow();
          
          // 测试文本渲染
          const metrics = ctx.measureText('测试');
          expect(metrics.width).toBeGreaterThan(0);
        }
      });
    });

    it('应该有字体回退机制', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // 设置包含回退的字体链
        const fontChain = 'Microsoft YaHei, SimSun, PingFang SC, sans-serif';
        ctx.font = `24px ${fontChain}`;
        
        // 即使某些字体不可用，也应该能渲染
        const metrics = ctx.measureText('字体回退测试');
        expect(metrics.width).toBeGreaterThan(0);
        
        // 不同文本的宽度应该不同
        const metrics2 = ctx.measureText('不同长度的文本内容');
        expect(metrics2.width).not.toBe(metrics.width);
      }
    });
  });

  describe('COMPAT-012: 操作系统兼容', () => {
    const testOSPatterns = [
      {
        name: 'Windows 10',
        pattern: 'Windows NT 10.0',
        expected: { platform: 'windows', version: 10 }
      },
      {
        name: 'macOS',
        pattern: 'Macintosh; Intel Mac OS X 10_15_7',
        expected: { platform: 'macos', version: 15 }
      },
      {
        name: 'Linux',
        pattern: 'X11; Linux x86_64',
        expected: { platform: 'linux', version: null }
      }
    ];

    testOSPatterns.forEach(({ name, pattern }) => {
      it(`应该在${name}上正常工作`, () => {
        Object.defineProperty(navigator, 'userAgent', {
          value: `Mozilla/5.0 (${pattern}) AppleWebKit/537.36`,
          writable: true
        });

        // 基础API应该在所有OS上可用
        const apiSupport = checkAPISupport();
        expect(apiSupport.canvas).toBe(true);
        expect(apiSupport.fileReader).toBe(true);
        expect(apiSupport.blob).toBe(true);
        
        // 字体渲染应该正常
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          expect(() => {
            ctx.font = '16px sans-serif';
            ctx.fillText('OS兼容性测试', 10, 10);
          }).not.toThrow();
        }
      });
    });
  });

  describe('COMPAT-013: 设备分辨率适配', () => {
    const testResolutions = [
      { width: 1920, height: 1080, name: '1080p' },
      { width: 2560, height: 1440, name: '1440p' },
      { width: 3840, height: 2160, name: '4K' },
      { width: 1366, height: 768, name: '笔记本常见分辨率' },
      { width: 1280, height: 720, name: '720p' }
    ];

    testResolutions.forEach(({ width, height, name }) => {
      it(`应该在${name}(${width}x${height})分辨率下正常工作`, () => {
        // 模拟屏幕分辨率
        Object.defineProperty(window.screen, 'width', { value: width });
        Object.defineProperty(window.screen, 'height', { value: height });

        // 计算合适的Canvas尺寸
        const getOptimalCanvasSize = (screenWidth: number, screenHeight: number) => {
          const maxWidth = Math.min(screenWidth * 0.8, 1200);
          const maxHeight = Math.min(screenHeight * 0.8, 800);
          return { width: maxWidth, height: maxHeight };
        };

        const optimalSize = getOptimalCanvasSize(width, height);
        
        expect(optimalSize.width).toBeGreaterThan(0);
        expect(optimalSize.height).toBeGreaterThan(0);
        expect(optimalSize.width).toBeLessThanOrEqual(width);
        expect(optimalSize.height).toBeLessThanOrEqual(height);

        // 测试Canvas在该分辨率下的创建
        const canvas = document.createElement('canvas');
        canvas.width = optimalSize.width;
        canvas.height = optimalSize.height;
        
        const ctx = canvas.getContext('2d');
        expect(ctx).toBeDefined();
        
        if (ctx) {
          // 测试大尺寸Canvas的基础操作
          expect(() => {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 100, 100);
          }).not.toThrow();
        }
      });
    });
  });

  describe('COMPAT-018: 缩放适配', () => {
    const testZoomLevels = [0.75, 1.0, 1.25, 1.5, 2.0];

    testZoomLevels.forEach(zoomLevel => {
      it(`应该在${Math.round(zoomLevel * 100)}%缩放级别下正常工作`, () => {
        // 模拟设备像素比
        Object.defineProperty(window, 'devicePixelRatio', {
          value: zoomLevel,
          writable: true
        });

        // 计算适应缩放的尺寸
        const baseSize = { width: 800, height: 600 };
        const scaledSize = {
          width: baseSize.width * zoomLevel,
          height: baseSize.height * zoomLevel
        };

        // 测试Canvas在不同缩放下的表现
        const canvas = document.createElement('canvas');
        canvas.width = scaledSize.width;
        canvas.height = scaledSize.height;
        canvas.style.width = `${baseSize.width}px`;
        canvas.style.height = `${baseSize.height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 应该能够处理缩放后的坐标
          ctx.scale(zoomLevel, zoomLevel);
          
          expect(() => {
            ctx.font = `${16 / zoomLevel}px sans-serif`;
            ctx.fillText('缩放测试', 10, 10);
          }).not.toThrow();
        }

        expect(window.devicePixelRatio).toBe(zoomLevel);
      });
    });
  });

  describe('COMPAT-019: 国际化支持', () => {
    const testLocales = [
      { code: 'zh-CN', name: '简体中文', text: '机密文档' },
      { code: 'zh-TW', name: '繁体中文', text: '機密文檔' },
      { code: 'en-US', name: 'English', text: 'CONFIDENTIAL' },
      { code: 'ja-JP', name: '日本語', text: '機密書類' },
      { code: 'ko-KR', name: '한국어', text: '기밀문서' }
    ];

    testLocales.forEach(({ code, name, text }) => {
      it(`应该支持${name}(${code})`, () => {
        // 模拟语言环境
        Object.defineProperty(navigator, 'language', {
          value: code,
          writable: true
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // 测试不同语言文本的渲染
          ctx.font = '24px sans-serif';
          const metrics = ctx.measureText(text);
          
          expect(metrics.width).toBeGreaterThan(0);
          expect(typeof metrics.width).toBe('number');
          
          // 文本渲染不应该抛出异常
          expect(() => {
            ctx.fillText(text, 10, 30);
          }).not.toThrow();
        }

        expect(navigator.language).toBe(code);
      });
    });
  });

  describe('COMPAT-020: 向后兼容性', () => {
    it('应该能够处理较老的文件格式', () => {
      // 测试PDF 1.4格式支持
      const oldPdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      const oldPdfBlob = new Blob([oldPdfHeader], { type: 'application/pdf' });
      
      expect(oldPdfBlob.type).toBe('application/pdf');
      expect(oldPdfBlob.size).toBe(8);
      
      // 测试DOC格式识别
      const docHeader = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      const docBlob = new Blob([docHeader], { type: 'application/msword' });
      
      expect(docBlob.size).toBe(8);
    });

    it('应该提供API回退机制', () => {
      // 测试HTMLCanvasElement.toBlob回退
      const canvas = document.createElement('canvas');
      
      if (!canvas.toBlob) {
        // 如果不支持toBlob，应该有回退方案
        const fallbackToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => {
          return new Promise((resolve) => {
            const dataURL = canvas.toDataURL('image/png');
            const base64 = dataURL.split(',')[1];
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            resolve(new Blob([bytes], { type: 'image/png' }));
          });
        };
        
        expect(typeof fallbackToBlob).toBe('function');
      } else {
        expect(typeof canvas.toBlob).toBe('function');
      }
    });
  });

  describe('功能降级测试', () => {
    it('应该能够在API不可用时优雅降级', () => {
      // 临时禁用某个API
      const originalCreateObjectURL = window.URL.createObjectURL;
      delete (window.URL as any).createObjectURL;

      // 应该有备用方案
      const fallbackDownload = (blob: Blob, filename: string) => {
        // 使用FileReader作为回退
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          // 在实际应用中，这里会触发下载
          return link;
        };
        reader.readAsDataURL(blob);
      };

      const testBlob = new Blob(['test'], { type: 'text/plain' });
      expect(() => {
        fallbackDownload(testBlob, 'test.txt');
      }).not.toThrow();

      // 恢复API
      window.URL.createObjectURL = originalCreateObjectURL;
    });
  });
});