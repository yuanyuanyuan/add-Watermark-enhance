/**
 * Vitest 测试环境设置
 */

import { vi } from 'vitest';

// 模拟 Canvas API
global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
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
  globalAlpha: 1,
  font: '16px Arial',
  fillStyle: '#000000',
  strokeStyle: '#000000',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  shadowColor: 'transparent',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
}));

global.HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock-data-url');
global.HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  const blob = new Blob(['mock-blob-data'], { type: 'image/png' });
  if (callback) callback(blob);
});

// 模拟 Web Workers
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as any;

// 模拟 Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
      verify: vi.fn().mockResolvedValue(true),
    },
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// 模拟 File API
global.FileReader = vi.fn().mockImplementation(() => ({
  readAsDataURL: vi.fn(function(this: FileReader) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({
          target: { result: 'data:image/png;base64,mock-file-data' }
        } as any);
      }
    }, 0);
  }),
  readAsArrayBuffer: vi.fn(function(this: FileReader) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({
          target: { result: new ArrayBuffer(1024) }
        } as any);
      }
    }, 0);
  }),
  onload: null,
  onerror: null,
})) as any;

// 模拟 URL API
global.URL = {
  createObjectURL: vi.fn(() => 'mock-object-url'),
  revokeObjectURL: vi.fn(),
} as any;

// 模拟性能API
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: vi.fn(() => Date.now()),
  } as any;
}

// 模拟 localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// 模拟 console 方法以减少测试输出噪音
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};