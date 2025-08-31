/**
 * 中文字体加载器
 * 使用 @pdf-lib/fontkit 实现PDF中文字体支持
 */

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';

export interface ChineseFontConfig {
  /** 字体名称 */
  name: string;
  /** 字体URL或base64数据 */
  url: string;
  /** 字体格式 */
  format: 'ttf' | 'otf' | 'woff' | 'woff2';
  /** 是否支持中文 */
  supportsChinese: boolean;
  /** 字体描述 */
  description?: string;
}

export class ChineseFontLoader {
  private static fontCache = new Map<string, Uint8Array>();
  private static registeredFonts: ChineseFontConfig[] = [
    {
      name: 'NotoSansSC',
      url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
      format: 'woff2',
      supportsChinese: true,
      description: 'Google Noto Sans 简体中文字体'
    },
    // 可以添加更多中文字体
  ];

  /**
   * 注册pdf-lib的fontkit插件
   */
  static registerFontkit(pdfDoc: PDFDocument): void {
    pdfDoc.registerFontkit(fontkit);
  }

  /**
   * 检测文本是否包含中文字符
   */
  static containsChineseCharacters(text: string): boolean {
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
    return chineseRegex.test(text);
  }

  /**
   * 获取可用的中文字体列表
   */
  static getAvailableChineseFonts(): ChineseFontConfig[] {
    return this.registeredFonts.filter(font => font.supportsChinese);
  }

  /**
   * 加载默认的中文字体数据
   * 由于浏览器限制，这里使用内嵌的中文字体子集
   */
  static async loadDefaultChineseFont(): Promise<Uint8Array> {
    const cacheKey = 'default-chinese';
    
    if (this.fontCache.has(cacheKey)) {
      return this.fontCache.get(cacheKey)!;
    }

    // 尝试多个CDN源 - 只使用实际字体文件，不是CSS
    const fontUrls = [
      'https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@release/SubsetOTF/SC/SourceHanSansSC-Regular.otf',
      'https://unpkg.com/@fontsource/noto-sans-sc@4.5.11/files/noto-sans-sc-chinese-simplified-400-normal.woff2',
      'https://fonts.gstatic.com/s/notosanssc/v36/k3kXo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.woff2'
    ];

    for (const fontUrl of fontUrls) {
      try {
        const response = await fetch(fontUrl);
        
        if (response.ok) {
          const fontData = new Uint8Array(await response.arrayBuffer());
          if (fontData.length > 0) {
            this.fontCache.set(cacheKey, fontData);
            console.log('成功加载中文字体从:', fontUrl);
            return fontData;
          }
        }
      } catch (error) {
        console.warn(`无法从 ${fontUrl} 加载中文字体:`, error);
        continue;
      }
    }

    // 备用方案：使用本地生成的中文字体子集
    console.warn('所有CDN字体加载失败，使用备用方案');
    return this.generateChineseFontSubset();
  }

  /**
   * 生成中文字体子集（包含常用字符）
   * 这是一个简化的字体数据，只包含基本字符
   */
  private static generateChineseFontSubset(): Uint8Array {
    // 这里应该包含一个最小的中文字体数据
    // 由于字体文件很大，这里返回一个占位符
    // 实际项目中应该包含真实的字体数据或使用字体子集工具
    
    console.warn('使用备用中文字体方案，可能无法正确显示所有中文字符');
    
    // 返回空数组，让调用者处理
    return new Uint8Array(0);
  }

  /**
   * 从本地文件加载字体
   */
  static async loadFontFromFile(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const fontData = new Uint8Array(reader.result as ArrayBuffer);
        resolve(fontData);
      };
      reader.onerror = () => reject(new Error('字体文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 验证字体是否支持特定文本
   */
  static async validateFontSupport(fontData: Uint8Array, text: string): Promise<boolean> {
    try {
      // 这里需要实际的字体解析逻辑
      // 简化处理：如果字体数据不为空且文本包含中文，则认为支持
      return fontData.length > 0 && this.containsChineseCharacters(text);
    } catch (error) {
      console.warn('字体支持验证失败:', error);
      return false;
    }
  }

  /**
   * 创建支持中文的PDF字体
   */
  static async createPDFFont(pdfDoc: PDFDocument, text: string) {
    // 确保注册了fontkit
    this.registerFontkit(pdfDoc);

    if (this.containsChineseCharacters(text)) {
      try {
        // 尝试加载中文字体
        const fontData = await this.loadDefaultChineseFont();
        
        if (fontData.length > 0) {
          return await pdfDoc.embedFont(fontData);
        }
      } catch (error) {
        console.warn('中文字体加载失败，将使用系统字体:', error);
      }
      
      // 如果中文字体加载失败，返回null，让调用者知道需要特殊处理
      console.warn('无法加载中文字体，请检查网络连接或使用离线字体');
      return null;
    }

    // 对于非中文文本，使用标准字体
    try {
      return await pdfDoc.embedFont('Helvetica');
    } catch (error) {
      console.warn('标准字体加载失败:', error);
      return null;
    }
  }

  /**
   * 获取字体度量信息（用于布局计算）
   */
  static getFontMetrics(font: any, text: string, fontSize: number) {
    try {
      const width = font.widthOfTextAtSize(text, fontSize);
      const height = font.heightAtSize(fontSize);
      
      return {
        width,
        height,
        ascent: font.sizeAtSize(fontSize).ascent || height * 0.8,
        descent: font.sizeAtSize(fontSize).descent || height * 0.2
      };
    } catch (error) {
      console.warn('字体度量计算失败，使用默认值:', error);
      return {
        width: text.length * fontSize * 0.6,
        height: fontSize,
        ascent: fontSize * 0.8,
        descent: fontSize * 0.2
      };
    }
  }
}