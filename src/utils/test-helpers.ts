/**
 * 测试辅助工具
 * 为水印功能测试提供模拟数据和工具函数
 */

import { expect, vi } from 'vitest';

// 创建模拟的File对象
export const createMockFile = (
  name: string = 'test-image.jpg',
  size: number = 1024,
  type: string = 'image/jpeg',
  content?: string
): File => {
  const blob = new Blob([content || 'fake-image-data'], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
};

// 创建模拟的Image元素
export const createMockImage = (width: number = 800, height: number = 600): HTMLImageElement => {
  const img = new Image();
  img.width = width;
  img.height = height;
  img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return img;
};

// 创建模拟的Canvas上下文
export const createMockCanvasContext = () => {
  const context = {
    drawImage: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    // 属性
    globalAlpha: 1,
    font: '16px Arial',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
  };
  
  return context as unknown as CanvasRenderingContext2D;
};

// 创建模拟的Canvas元素
export const createMockCanvas = (width: number = 800, height: number = 600) => {
  const canvas = {
    width,
    height,
    getContext: vi.fn().mockReturnValue(createMockCanvasContext()),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock-data-url'),
    toBlob: vi.fn().mockImplementation((callback) => {
      const blob = new Blob(['mock-blob-data'], { type: 'image/png' });
      callback(blob);
    })
  };
  
  return canvas as unknown as HTMLCanvasElement;
};

// 模拟水印设置
export const createMockWatermarkSettings = () => ({
  type: 'text' as const,
  text: {
    content: '测试水印',
    font: {
      family: 'Arial',
      size: 24,
      weight: 'normal',
      style: 'normal'
    },
    color: '#ff0000'
  },
  position: {
    placement: 'corner' as const,
    corner: 'bottom-right' as const,
    opacity: 0.7,
    scale: 1.0,
    rotation: 0
  },
  output: {
    format: 'png' as const,
    quality: 0.9
  }
});

// 测试用的等待函数
export const waitFor = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 验证Canvas操作的辅助函数
export const expectCanvasOperations = (context: any, operations: string[]) => {
  operations.forEach(operation => {
    expect(context[operation]).toHaveBeenCalled();
  });
};

// 验证水印结果的辅助函数
export const expectWatermarkResult = (result: any, shouldSucceed: boolean = true) => {
  expect(result).toBeDefined();
  expect(result.success).toBe(shouldSucceed);
  expect(result.originalFile).toBeDefined();
  expect(typeof result.processingTime).toBe('number');
  
  if (shouldSucceed) {
    expect(result.processedImage).toBeDefined();
    expect(result.processedImage.blob).toBeDefined();
    expect(result.processedImage.dataUrl).toBeTruthy();
    expect(result.processedImage.size).toBeGreaterThan(0);
    expect(result.processedImage.dimensions).toBeDefined();
    expect(result.processedImage.dimensions.width).toBeGreaterThan(0);
    expect(result.processedImage.dimensions.height).toBeGreaterThan(0);
  } else {
    expect(result.error).toBeDefined();
  }
};