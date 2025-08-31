/**
 * 中文水印渲染测试 - 单元测试
 * 测试用例覆盖：WM-001~025
 * 包含：基础中文渲染、网格水印算法、字体回退机制、Canvas渲染优化
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChineseWatermarkRenderer } from '../ChineseWatermarkRenderer';
import type { ChineseWatermarkOptions, WatermarkImageResult } from '../ChineseWatermarkRenderer';

// Mock Canvas API
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => ({
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: 'center',
    textBaseline: 'middle',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    measureText: vi.fn(() => ({ width: 100 })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }))
  })),
  toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='),
  toBlob: vi.fn((callback) => {
    const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
    callback(mockBlob);
  })
};

// Mock document.createElement
global.document = {
  createElement: vi.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    return null;
  })
} as any;

describe('ChineseWatermarkRenderer - 中文水印渲染测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.width = 0;
    mockCanvas.height = 0;
  });

  afterEach(() => {
    // 清理测试状态
  });

  describe('A. 基础中文渲染功能 (8用例)', () => {
    it('WM-001: 中文字符检测准确性', () => {
      // 测试各种中文字符
      expect(ChineseWatermarkRenderer.containsChineseCharacters('机密文档')).toBe(true);
      expect(ChineseWatermarkRenderer.containsChineseCharacters('CONFIDENTIAL')).toBe(false);
      expect(ChineseWatermarkRenderer.containsChineseCharacters('机密CONFIDENTIAL')).toBe(true);
      expect(ChineseWatermarkRenderer.containsChineseCharacters('123456')).toBe(false);
      expect(ChineseWatermarkRenderer.containsChineseCharacters('')).toBe(false);
      
      // 测试特殊中文字符
      expect(ChineseWatermarkRenderer.containsChineseCharacters('中文测试🈲')).toBe(true);
      expect(ChineseWatermarkRenderer.containsChineseCharacters('繁體中文')).toBe(true);
      
      // 边界情况
      expect(ChineseWatermarkRenderer.containsChineseCharacters('中')).toBe(true);
      expect(ChineseWatermarkRenderer.containsChineseCharacters('㈠㈡㈢')).toBe(true); // 中文数字
    });

    it('WM-002: 中文水印图像生成', async () => {
      const options: ChineseWatermarkOptions = {
        text: '机密文档',
        fontSize: 24,
        color: '#000000',
        opacity: 0.5,
        rotation: 45,
        fontFamily: 'Microsoft YaHei'
      };

      const result = await ChineseWatermarkRenderer.createChineseWatermarkImage(options);

      expect(result).toBeDefined();
      expect(result.canvas).toBe(mockCanvas);
      expect(result.dataUrl).toContain('data:image/png;base64,');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.dimensions.width).toBeGreaterThan(0);
      expect(result.dimensions.height).toBeGreaterThan(0);

      // 验证Canvas配置
      const ctx = mockCanvas.getContext('2d');
      expect(ctx.font).toContain('24px');
      expect(ctx.font).toContain('Microsoft YaHei');
      expect(ctx.fillText).toHaveBeenCalledWith('机密文档', 0, 0);
    });

    it('WM-003: Canvas尺寸动态计算', async () => {
      const shortText = { text: '短', fontSize: 12, color: '#000', opacity: 0.5, rotation: 0 };
      const longText = { text: '这是一个很长的水印文本内容', fontSize: 24, color: '#000', opacity: 0.5, rotation: 0 };
      const rotatedText = { text: '旋转文本', fontSize: 20, color: '#000', opacity: 0.5, rotation: 45 };

      // Mock measureText 返回不同宽度
      const mockCtx = mockCanvas.getContext('2d');
      mockCtx.measureText
        .mockReturnValueOnce({ width: 20 })  // 短文本
        .mockReturnValueOnce({ width: 200 }) // 长文本
        .mockReturnValueOnce({ width: 80 });  // 旋转文本

      const shortResult = await ChineseWatermarkRenderer.createChineseWatermarkImage(shortText);
      const longResult = await ChineseWatermarkRenderer.createChineseWatermarkImage(longText);
      const rotatedResult = await ChineseWatermarkRenderer.createChineseWatermarkImage(rotatedText);

      // 验证尺寸计算
      expect(longResult.dimensions.width).toBeGreaterThan(shortResult.dimensions.width);
      expect(rotatedResult.dimensions.width).toBeGreaterThan(rotatedText.fontSize); // 旋转会增加边界框
      expect(rotatedResult.dimensions.height).toBeGreaterThan(rotatedText.fontSize);
    });

    it('WM-004: 透明度设置正确性', async () => {
      const lowOpacity = { text: '低透明度', fontSize: 20, color: '#FF0000', opacity: 0.2, rotation: 0 };
      const highOpacity = { text: '高透明度', fontSize: 20, color: '#FF0000', opacity: 0.8, rotation: 0 };

      await ChineseWatermarkRenderer.createChineseWatermarkImage(lowOpacity);
      await ChineseWatermarkRenderer.createChineseWatermarkImage(highOpacity);

      const ctx = mockCanvas.getContext('2d');
      
      // 验证透明度应用
      expect(ctx.fillStyle).toBe('rgba(255, 0, 0, 0.8)'); // 最后一次调用
    });

    it('WM-005: 旋转角度精确控制', async () => {
      const angles = [0, 45, 90, -30, 180];
      
      for (const rotation of angles) {
        const options = { text: '旋转测试', fontSize: 20, color: '#000', opacity: 0.5, rotation };
        await ChineseWatermarkRenderer.createChineseWatermarkImage(options);
        
        const ctx = mockCanvas.getContext('2d');
        if (rotation !== 0) {
          expect(ctx.rotate).toHaveBeenCalledWith((rotation * Math.PI) / 180);
        }
      }
    });

    it('WM-006: 颜色渲染准确性', async () => {
      const colors = [
        { hex: '#FF0000', rgb: 'rgba(255, 0, 0, 0.5)' },
        { hex: '#00FF00', rgb: 'rgba(0, 255, 0, 0.5)' },
        { hex: '#0000FF', rgb: 'rgba(0, 0, 255, 0.5)' },
        { hex: '#123456', rgb: 'rgba(18, 52, 86, 0.5)' }
      ];

      for (const { hex, rgb } of colors) {
        const options = { text: '颜色测试', fontSize: 20, color: hex, opacity: 0.5, rotation: 0 };
        await ChineseWatermarkRenderer.createChineseWatermarkImage(options);
        
        const ctx = mockCanvas.getContext('2d');
        expect(ctx.fillStyle).toBe(rgb);
      }
    });

    it('WM-007: 文本尺寸测量', () => {
      const testCases = [
        { text: '单字', fontSize: 12, expectedRatio: 0.6 },
        { text: '中文测试', fontSize: 24, expectedRatio: 0.6 },
        { text: '很长的水印文本内容测试', fontSize: 16, expectedRatio: 0.6 }
      ];

      for (const { text, fontSize, expectedRatio } of testCases) {
        const dimensions = ChineseWatermarkRenderer.estimateTextDimensions(text, fontSize, 0);
        
        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBe(fontSize);
        
        // 验证中文字符宽度估算合理性
        const expectedWidth = text.length * fontSize * expectedRatio;
        expect(dimensions.width).toBeCloseTo(expectedWidth, -1); // 允许一定误差
      }
    });

    it('WM-008: PNG格式输出验证', async () => {
      const options = { text: '格式测试', fontSize: 20, color: '#000', opacity: 0.5, rotation: 0 };
      const result = await ChineseWatermarkRenderer.createChineseWatermarkImage(options);

      // 验证输出格式
      expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.blob.type).toBe('image/png');
      expect(result.blob.size).toBeGreaterThan(0);

      // 验证Canvas调用
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    });
  });

  describe('B. 网格水印生成算法 (7用例)', () => {
    it('WM-009: 网格位置计算算法', async () => {
      const pageSize = { width: 800, height: 600 };
      const options = { text: '网格测试', fontSize: 20, color: '#000', opacity: 0.3, rotation: 0 };
      const gridSettings = { spacingX: 200, spacingY: 150, layers: 1, densityMode: 'normal' as const };

      const result = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, gridSettings);

      expect(result.watermarkData).toBeDefined();
      expect(result.watermarkData.length).toBeGreaterThan(0);
      
      // 验证网格布局
      const watermarks = result.watermarkData;
      expect(watermarks.every(w => w.position.x >= 50)).toBe(true); // 边界检查
      expect(watermarks.every(w => w.position.y >= 50)).toBe(true);
      expect(watermarks.every(w => w.position.x <= pageSize.width - 50)).toBe(true);
      expect(watermarks.every(w => w.position.y <= pageSize.height - 50)).toBe(true);

      // 验证间距
      const sortedByX = watermarks.sort((a, b) => a.position.x - b.position.x);
      if (sortedByX.length > 1) {
        const xSpacing = sortedByX[1].position.x - sortedByX[0].position.x;
        expect(xSpacing).toBeCloseTo(200, 50); // 允许50px误差
      }
    });

    it('WM-010: 200px间距精确控制', async () => {
      const pageSize = { width: 1000, height: 800 };
      const options = { text: '间距测试', fontSize: 16, color: '#000', opacity: 0.4, rotation: 0 };
      const gridSettings = { spacingX: 200, spacingY: 200 };

      const result = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, gridSettings);

      const watermarks = result.watermarkData.filter(w => w.layer === 0); // 只看第一层
      
      // 按行分组检查间距
      const rows = new Map<number, typeof watermarks>();
      watermarks.forEach(w => {
        const rowKey = Math.round(w.position.y / 200) * 200;
        if (!rows.has(rowKey)) rows.set(rowKey, []);
        rows.get(rowKey)!.push(w);
      });

      // 检查每行内的水印间距
      rows.forEach(rowWatermarks => {
        const sorted = rowWatermarks.sort((a, b) => a.position.x - b.position.x);
        for (let i = 1; i < sorted.length; i++) {
          const spacing = sorted[i].position.x - sorted[i-1].position.x;
          expect(spacing).toBeCloseTo(200, 10); // 允许10px误差
        }
      });
    });

    it('WM-011: 交错排列布局', async () => {
      const pageSize = { width: 800, height: 600 };
      const options = { text: '交错测试', fontSize: 18, color: '#000', opacity: 0.3, rotation: 0 };

      const result = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, {
        spacingX: 200,
        spacingY: 150,
        layers: 1
      });

      const watermarks = result.watermarkData;
      
      // 按行分组
      const rows = new Map<number, typeof watermarks>();
      watermarks.forEach(w => {
        const rowIndex = Math.round((w.position.y - 50) / 150);
        if (!rows.has(rowIndex)) rows.set(rowIndex, []);
        rows.get(rowIndex)!.push(w);
      });

      // 检查奇数行是否有偏移
      const rowIndices = Array.from(rows.keys()).sort((a, b) => a - b);
      if (rowIndices.length > 1) {
        const evenRowWatermarks = rows.get(rowIndices[0])!.sort((a, b) => a.position.x - b.position.x);
        const oddRowWatermarks = rows.get(rowIndices[1])!.sort((a, b) => a.position.x - b.position.x);
        
        if (evenRowWatermarks.length > 0 && oddRowWatermarks.length > 0) {
          const offset = oddRowWatermarks[0].position.x - evenRowWatermarks[0].position.x;
          expect(Math.abs(offset)).toBeGreaterThan(50); // 应该有明显偏移
        }
      }
    });

    it('WM-012: 页面边界检测', async () => {
      const smallPage = { width: 300, height: 200 }; // 很小的页面
      const options = { text: '边界测试', fontSize: 20, color: '#000', opacity: 0.3, rotation: 0 };
      const gridSettings = { spacingX: 100, spacingY: 100, boundaryMargin: 50 };

      const result = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, smallPage, gridSettings);

      const watermarks = result.watermarkData;
      
      // 所有水印都应该在边界内
      watermarks.forEach(w => {
        expect(w.position.x).toBeGreaterThanOrEqual(50); // 左边界
        expect(w.position.y).toBeGreaterThanOrEqual(50); // 上边界
        expect(w.position.x).toBeLessThanOrEqual(smallPage.width - 50); // 右边界
        expect(w.position.y).toBeLessThanOrEqual(smallPage.height - 50); // 下边界
      });

      // 小页面应该产生较少的水印
      expect(watermarks.length).toBeLessThan(10);
    });

    it('WM-013: 多层水印布局', async () => {
      const pageSize = { width: 600, height: 400 };
      const options = { text: '多层测试', fontSize: 16, color: '#000', opacity: 0.4, rotation: 0 };
      const gridSettings = { spacingX: 150, spacingY: 120, layers: 3 };

      const result = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, gridSettings);

      const watermarks = result.watermarkData;
      expect(result.stats.layers).toBe(3);

      // 检查每层都有水印
      const layerCounts = new Map<number, number>();
      watermarks.forEach(w => {
        layerCounts.set(w.layer, (layerCounts.get(w.layer) || 0) + 1);
      });

      expect(layerCounts.size).toBe(3); // 3个不同的层
      expect(layerCounts.get(0)).toBeGreaterThan(0);
      expect(layerCounts.get(1)).toBeGreaterThan(0);
      expect(layerCounts.get(2)).toBeGreaterThan(0);

      // 检查不同层的透明度
      const layer0 = watermarks.filter(w => w.layer === 0);
      const layer1 = watermarks.filter(w => w.layer === 1);
      const layer2 = watermarks.filter(w => w.layer === 2);

      expect(layer1[0].opacity).toBeLessThan(layer0[0].opacity); // 后续层透明度递减
      expect(layer2[0].opacity).toBeLessThan(layer1[0].opacity);
    });

    it('WM-014: 网格水印密度控制', async () => {
      const pageSize = { width: 800, height: 600 };
      const options = { text: '密度测试', fontSize: 16, color: '#000', opacity: 0.3, rotation: 0 };

      const sparseResult = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, {
        spacingX: 200,
        spacingY: 150,
        densityMode: 'sparse'
      });

      const normalResult = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, {
        spacingX: 200,
        spacingY: 150,
        densityMode: 'normal'
      });

      const denseResult = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, {
        spacingX: 200,
        spacingY: 150,
        densityMode: 'dense'
      });

      // 验证密度递增
      expect(sparseResult.watermarkData.length).toBeLessThan(normalResult.watermarkData.length);
      expect(normalResult.watermarkData.length).toBeLessThan(denseResult.watermarkData.length);

      // 验证覆盖率
      expect(sparseResult.stats.coverage).toBeLessThan(normalResult.stats.coverage);
      expect(normalResult.stats.coverage).toBeLessThan(denseResult.stats.coverage);
    });

    it('WM-015: 自定义网格间距', async () => {
      const pageSize = { width: 1000, height: 800 };
      const options = { text: '自定义间距', fontSize: 20, color: '#000', opacity: 0.3, rotation: 0 };

      const customSpacings = [
        { spacingX: 100, spacingY: 100 },
        { spacingX: 300, spacingY: 200 },
        { spacingX: 150, spacingY: 300 }
      ];

      const results = await Promise.all(
        customSpacings.map(spacing => 
          ChineseWatermarkRenderer.createGridWatermarkForPDF(options, pageSize, spacing)
        )
      );

      // 验证不同间距产生不同数量的水印
      const counts = results.map(r => r.watermarkData.length);
      expect(counts[0]).toBeGreaterThan(counts[1]); // 小间距 > 大间距
      expect(counts[1]).not.toBe(counts[2]); // 不同配置产生不同结果

      // 验证间距应用
      results.forEach((result, index) => {
        const { spacingX } = customSpacings[index];
        const watermarks = result.watermarkData.filter(w => w.layer === 0);
        
        if (watermarks.length > 1) {
          // 验证实际间距接近设定值
          const sortedX = watermarks.sort((a, b) => a.position.x - b.position.x);
          if (sortedX.length > 1) {
            const actualSpacingX = sortedX[1].position.x - sortedX[0].position.x;
            expect(actualSpacingX).toBeCloseTo(spacingX * 0.7, spacingX * 0.2); // 允许一定误差
          }
        }
      });
    });
  });

  describe('C. 字体回退机制 (5用例)', () => {
    it('WM-017: 字体可用性检测', () => {
      // Mock Canvas context for font detection
      const mockContext = {
        font: '',
        measureText: vi.fn(() => ({ width: 100 }))
      };

      global.document.createElement = vi.fn(() => ({
        getContext: (_contextType: string) => mockContext
      })) as any;

      const optimalFont = ChineseWatermarkRenderer.detectOptimalChineseFont('中文测试');

      expect(optimalFont).toBeDefined();
      expect(typeof optimalFont).toBe('string');
      expect(mockContext.measureText).toHaveBeenCalledWith('中文测试');
    });

    it('WM-018: 中文字体优先级', () => {
      const testText = '机密文档测试';
      const detectedFont = ChineseWatermarkRenderer.detectOptimalChineseFont(testText);

      // 应该返回优先级列表中的字体
      const priorityFonts = ['Microsoft YaHei', 'SimSun', 'PingFang SC', 'Hiragino Sans GB'];
      expect(priorityFonts).toContain(detectedFont);
    });

    it('WM-019: 系统字体回退链', async () => {
      const options: ChineseWatermarkOptions = {
        text: '字体回退测试',
        fontSize: 20,
        color: '#000000',
        opacity: 0.5,
        rotation: 0
        // 不指定fontFamily，应该使用默认回退链
      };

      const result = await ChineseWatermarkRenderer.createChineseWatermarkImage(options);
      const ctx = mockCanvas.getContext('2d');

      // 验证字体设置包含回退字体
      expect(ctx.font).toContain('Microsoft YaHei');
      expect(ctx.font).toContain('sans-serif'); // 最终回退
      expect(result.canvas).toBeDefined();
    });

    it('WM-020: 跨平台字体兼容', async () => {
      const testFonts = [
        'Microsoft YaHei',    // Windows
        'PingFang SC',        // macOS
        'WenQuanYi Micro Hei', // Linux
        'Noto Sans CJK SC',   // 通用
        'SimSun'              // 传统
      ];

      for (const fontFamily of testFonts) {
        const options = {
          text: '跨平台测试',
          fontSize: 18,
          color: '#000000',
          opacity: 0.4,
          rotation: 0,
          fontFamily
        };

        const result = await ChineseWatermarkRenderer.createChineseWatermarkImage(options);
        expect(result).toBeDefined();
        expect(result.dimensions.width).toBeGreaterThan(0);

        const ctx = mockCanvas.getContext('2d');
        expect(ctx.font).toContain(fontFamily);
      }
    });

    it('WM-021: 字体加载失败处理', async () => {
      // 模拟字体加载失败
      const invalidFont = 'NonExistentFont123';
      const options = {
        text: '字体失败测试',
        fontSize: 20,
        color: '#000000',
        opacity: 0.5,
        rotation: 0,
        fontFamily: invalidFont
      };

      // 应该不会抛出异常，而是使用回退字体
      const result = await ChineseWatermarkRenderer.createChineseWatermarkImage(options);
      expect(result).toBeDefined();
      expect(result.canvas).toBeDefined();

      const ctx = mockCanvas.getContext('2d');
      // 应该包含回退字体
      expect(ctx.font).toContain('sans-serif');
    });
  });

  describe('D. Canvas渲染优化 (2用例)', () => {
    it('WM-022: 高质量渲染设置', () => {
      const mockContext = {
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        textBaseline: 'top',
        textAlign: 'left'
      };

      ChineseWatermarkRenderer.enhanceCanvasRenderingQuality(mockContext as any);

      expect(mockContext.imageSmoothingEnabled).toBe(true);
      expect(mockContext.imageSmoothingQuality).toBe('high');
      expect(mockContext.textBaseline).toBe('middle');
      expect(mockContext.textAlign).toBe('center');
    });

    it('WM-023: 抗锯齿效果验证', async () => {
      const options = {
        text: '抗锯齿测试',
        fontSize: 32,
        color: '#000000',
        opacity: 0.7,
        rotation: 15
      };

      const result = await ChineseWatermarkRenderer.createChineseWatermarkImage(options);
      const ctx = mockCanvas.getContext('2d');

      // 验证抗锯齿设置
      expect(ctx.imageSmoothingEnabled).toBe(true);
      expect(ctx.imageSmoothingQuality).toBe('high');

      // 验证渲染结果
      expect(result.dimensions.width).toBeGreaterThan(0);
      expect(result.dimensions.height).toBeGreaterThan(0);
    });
  });

  describe('性能和批量处理测试', () => {
    it('批量水印创建性能', async () => {
      const baseOptions = {
        text: '批量测试',
        fontSize: 20,
        color: '#000000',
        opacity: 0.5,
        rotation: 0
      };

      const variations = Array(20).fill(0).map((_, i) => ({
        textVariant: `批量测试${i}`,
        opacityMultiplier: 0.8 + i * 0.01,
        rotationOffset: i * 5,
        sizeMultiplier: 1 + i * 0.05
      }));

      const startTime = performance.now();
      const results = await ChineseWatermarkRenderer.createBatchWatermarks(baseOptions, variations, 5);
      const endTime = performance.now();

      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒内完成
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.dataUrl).toContain('data:image/png');
      });
    });

    it('大尺寸水印处理', async () => {
      const largeOptions = {
        text: '大尺寸水印测试内容比较长用来测试性能',
        fontSize: 48,
        color: '#FF0000',
        opacity: 0.6,
        rotation: 30
      };

      const startTime = performance.now();
      const result = await ChineseWatermarkRenderer.createChineseWatermarkImage(largeOptions);
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(result.dimensions.width).toBeGreaterThan(200);
      expect(result.dimensions.height).toBeGreaterThan(48);
      expect(endTime - startTime).toBeLessThan(1000); // 1秒内完成
    });

    it('网格水印大页面处理', async () => {
      const largePage = { width: 2000, height: 1500 };
      const options = { text: '大页面', fontSize: 16, color: '#000', opacity: 0.3, rotation: 0 };
      const gridSettings = { spacingX: 150, spacingY: 120 };

      const startTime = performance.now();
      const result = await ChineseWatermarkRenderer.createGridWatermarkForPDF(options, largePage, gridSettings);
      const endTime = performance.now();

      expect(result.watermarkData.length).toBeGreaterThan(50); // 大页面应产生很多水印
      expect(result.stats.totalWatermarks).toBe(result.watermarkData.length);
      expect(endTime - startTime).toBeLessThan(3000); // 3秒内完成
      expect(result.stats.renderTime).toBeGreaterThan(0);
    });
  });
});