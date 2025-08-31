/**
 * downloadHelper 单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  downloadFile, 
  generateWatermarkedFilename, 
  downloadMultipleFiles,
  checkDownloadSupport 
} from '../downloadHelper';

// 模拟DOM API
const mockLink = {
  href: '',
  download: '',
  click: vi.fn()
};

const mockDocument = {
  createElement: vi.fn().mockReturnValue(mockLink),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
};

// 模拟alert
global.alert = vi.fn();

describe('downloadHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.document = mockDocument as any;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('downloadFile', () => {
    it('should create download link and trigger click', () => {
      const dataUrl = 'data:image/png;base64,mock-data';
      const filename = 'test-image.png';
      
      downloadFile(dataUrl, filename);
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe(dataUrl);
      expect(mockLink.download).toBe(filename);
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('should handle download errors gracefully', () => {
      mockLink.click = vi.fn().mockImplementation(() => {
        throw new Error('Download failed');
      });
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      downloadFile('invalid-url', 'test.png');
      
      expect(consoleError).toHaveBeenCalled();
      expect(global.alert).toHaveBeenCalledWith('下载失败，请重试');
      
      consoleError.mockRestore();
    });
  });

  describe('generateWatermarkedFilename', () => {
    it('should add _watermarked suffix before file extension', () => {
      expect(generateWatermarkedFilename('photo.jpg')).toBe('photo_watermarked.jpg');
      expect(generateWatermarkedFilename('image.png')).toBe('image_watermarked.png');
      expect(generateWatermarkedFilename('document.pdf')).toBe('document_watermarked.pdf');
    });

    it('should handle files without extension', () => {
      expect(generateWatermarkedFilename('filename')).toBe('filename_watermarked');
    });

    it('should handle files with multiple dots', () => {
      expect(generateWatermarkedFilename('my.file.name.jpg')).toBe('my.file.name_watermarked.jpg');
    });

    it('should handle empty filename', () => {
      expect(generateWatermarkedFilename('')).toBe('_watermarked');
    });
  });

  describe('downloadMultipleFiles', () => {
    it('should handle empty file list', async () => {
      await downloadMultipleFiles([]);
      
      expect(global.alert).toHaveBeenCalledWith('没有可下载的文件');
      expect(mockLink.click).not.toHaveBeenCalled();
    });

    it('should download single file directly', async () => {
      const files = [{
        dataUrl: 'data:image/png;base64,test1',
        filename: 'test1.png'
      }];
      
      await downloadMultipleFiles(files);
      
      expect(mockLink.click).toHaveBeenCalledTimes(1);
      expect(mockLink.href).toBe('data:image/png;base64,test1');
      expect(mockLink.download).toBe('test1.png');
    });

    it('should download multiple files with delay', async () => {
      const files = [
        { dataUrl: 'data:image/png;base64,test1', filename: 'test1.png' },
        { dataUrl: 'data:image/png;base64,test2', filename: 'test2.png' },
        { dataUrl: 'data:image/png;base64,test3', filename: 'test3.png' }
      ];
      
      downloadMultipleFiles(files);
      
      // 立即检查第一个文件没有被下载（因为有延迟）
      expect(mockLink.click).not.toHaveBeenCalled();
      
      // 推进时间，检查第一个文件
      vi.advanceTimersByTime(0);
      expect(mockLink.click).toHaveBeenCalledTimes(1);
      
      // 推进时间500ms，检查第二个文件
      vi.advanceTimersByTime(500);
      expect(mockLink.click).toHaveBeenCalledTimes(2);
      
      // 推进时间500ms，检查第三个文件
      vi.advanceTimersByTime(500);
      expect(mockLink.click).toHaveBeenCalledTimes(3);
      
      expect(global.alert).toHaveBeenCalledWith('正在下载 3 个文件，请注意浏览器下载提示');
    });
  });

  describe('checkDownloadSupport', () => {
    it('should return true when download attribute is supported', () => {
      const mockSupportedLink = {
        download: ''
      };
      mockDocument.createElement.mockReturnValue(mockSupportedLink);
      
      expect(checkDownloadSupport()).toBe(true);
    });

    it('should return false when download attribute is not supported', () => {
      const mockUnsupportedLink = {};
      mockDocument.createElement.mockReturnValue(mockUnsupportedLink);
      
      expect(checkDownloadSupport()).toBe(false);
    });
  });
});