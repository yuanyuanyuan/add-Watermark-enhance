/**
 * 简化的水印处理器 - 确保基本功能正常工作
 * 使用原生Canvas API实现，避免复杂的架构导致的问题
 */

export interface SimpleColorConfig {
  type: 'solid' | 'gradient' | 'multi';
  primary: string;
  secondary?: string;
  gradient?: {
    type: 'linear' | 'radial';
    stops: Array<{ offset: number; color: string; }>;
    angle?: number;
    centerX?: number;
    centerY?: number;
    radius?: number;
  };
  multi?: string[];
}

export interface SimpleWatermarkSettings {
  type: 'text' | 'image' | 'hybrid';
  text?: {
    content: string;
    font?: {
      family: string;
      size: number;
      weight: string;
      style: string;
    };
    color: string | SimpleColorConfig;
  };
  position: {
    placement: 'corner' | 'center' | 'edge' | 'pattern' | 'custom';
    corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    edge?: 'top' | 'right' | 'bottom' | 'left';
    pattern?: {
      type?: 'default' | 'tiled-3-column' | 'random';
      spacing: { x: number; y: number; };
      offset?: { x: number; y: number; };
      stagger?: boolean;
      columns?: number;
      rows?: number;
      randomSeed?: number;
      density?: number;
      avoidOverlap?: boolean;
    };
    margin?: { top: number; right: number; bottom: number; left: number; };
    opacity: number;
    scale: number;
    rotation?: number;
    blendMode?: string;
  };
  security?: {
    blockChineseCharacters?: boolean;
    allowedLanguages?: ('en' | 'zh' | 'ja' | 'ko' | 'all')[];
  };
  output: {
    format: 'png' | 'jpeg' | 'webp' | 'pdf' | 'docx' | 'word-to-pdf' | 'original';
    quality: number;
    preserveOriginalMetadata?: boolean;
    compression?: {
      enabled: boolean;
      level: 'low' | 'medium' | 'high';
    };
  };
}

export interface SimpleWatermarkResult {
  success: boolean;
  originalFile: File;
  processedImage?: {
    blob: Blob;
    dataUrl: string;
    size: number;
    dimensions: { width: number; height: number };
    format: string;
  };
  error?: string;
  processingTime: number;
}

export class SimpleWatermarkProcessor {
  /**
   * 检测文本中是否包含中文字符
   */
  private containsChineseCharacters(text: string): boolean {
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
    return chineseRegex.test(text);
  }

  /**
   * 检测文本中是否包含日文字符
   */
  private containsJapaneseCharacters(text: string): boolean {
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
    return japaneseRegex.test(text);
  }

  /**
   * 检测文本中是否包含韩文字符
   */
  private containsKoreanCharacters(text: string): boolean {
    const koreanRegex = /[\uac00-\ud7af]/;
    return koreanRegex.test(text);
  }

  /**
   * 验证水印文本是否符合语言限制
   * 现在PDF格式也支持中文字符
   */
  private validateTextLanguage(text: string, settings: SimpleWatermarkSettings, outputFormat?: string): void {
    // PDF格式现在支持中文字符（通过fontkit实现）
    console.log('文本语言验证 - PDF中文支持已启用:', {
      text,
      outputFormat,
      containsChinese: this.containsChineseCharacters(text)
    });

    if (!settings.security) return;

    const { blockChineseCharacters, allowedLanguages } = settings.security;

    // 如果启用了中文字符阻止
    if (blockChineseCharacters && this.containsChineseCharacters(text)) {
      throw new Error('水印文本包含中文字符，处理已被阻止。请使用其他语言的文本。');
    }

    // 如果设置了允许的语言列表
    if (allowedLanguages && !allowedLanguages.includes('all')) {
      const hasChines = this.containsChineseCharacters(text);
      const hasJapanese = this.containsJapaneseCharacters(text);
      const hasKorean = this.containsKoreanCharacters(text);

      if (hasChines && !allowedLanguages.includes('zh')) {
        throw new Error('水印文本包含不被允许的中文字符');
      }
      if (hasJapanese && !allowedLanguages.includes('ja')) {
        throw new Error('水印文本包含不被允许的日文字符');
      }
      if (hasKorean && !allowedLanguages.includes('ko')) {
        throw new Error('水印文本包含不被允许的韩文字符');
      }
    }
  }

  /**
   * 处理单个图片文件添加水印
   */
  async processFile(file: File, settings: SimpleWatermarkSettings): Promise<SimpleWatermarkResult> {
    const startTime = performance.now();
    
    try {
      // 1. 验证水印文本语言（如果是文本水印）
      if (settings.type === 'text' && settings.text) {
        this.validateTextLanguage(settings.text.content, settings, settings.output?.format);
      }
      
      // 2. 加载图片
      const imageElement = await this.loadImageFromFile(file);
      
      // 2. 创建Canvas并添加水印
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('无法创建Canvas上下文');
      }
      
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      
      // 3. 绘制原始图片
      ctx.drawImage(imageElement, 0, 0);
      
      // 4. 添加水印
      await this.addWatermark(ctx, canvas, settings);
      
      // 5. 转换为Blob和DataURL
      const blob = await this.canvasToBlob(canvas, settings.output.format, settings.output.quality);
      const dataUrl = canvas.toDataURL(`image/${settings.output.format}`, settings.output.quality);
      
      const processingTime = performance.now() - startTime;
      
      return {
        success: true,
        originalFile: file,
        processedImage: {
          blob,
          dataUrl,
          size: blob.size,
          dimensions: {
            width: canvas.width,
            height: canvas.height
          },
          format: settings.output.format
        },
        processingTime
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('水印处理失败:', error);
      
      return {
        success: false,
        originalFile: file,
        error: error instanceof Error ? error.message : '未知错误',
        processingTime
      };
    }
  }
  
  /**
   * 从File对象加载图片
   */
  private loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }
  
  /**
   * 在Canvas上添加水印
   */
  private async addWatermark(
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    settings: SimpleWatermarkSettings
  ): Promise<void> {
    // 保存当前状态
    ctx.save();
    
    // 设置全局透明度
    ctx.globalAlpha = settings.position.opacity;
    
    if (settings.type === 'text' && settings.text) {
      await this.addTextWatermark(ctx, canvas, settings);
    }
    
    // 恢复状态
    ctx.restore();
  }
  
  /**
   * 创建颜色填充样式
   */
  private createColorStyle(ctx: CanvasRenderingContext2D, colorConfig: string | SimpleColorConfig, canvas: HTMLCanvasElement): string | CanvasGradient {
    if (typeof colorConfig === 'string') {
      return colorConfig;
    }

    switch (colorConfig.type) {
      case 'gradient':
        if (colorConfig.gradient) {
          const gradient = colorConfig.gradient;
          let canvasGradient: CanvasGradient;
          
          if (gradient.type === 'linear') {
            const angle = (gradient.angle || 0) * Math.PI / 180;
            const x1 = canvas.width / 2 - Math.cos(angle) * canvas.width / 2;
            const y1 = canvas.height / 2 - Math.sin(angle) * canvas.height / 2;
            const x2 = canvas.width / 2 + Math.cos(angle) * canvas.width / 2;
            const y2 = canvas.height / 2 + Math.sin(angle) * canvas.height / 2;
            canvasGradient = ctx.createLinearGradient(x1, y1, x2, y2);
          } else {
            const centerX = gradient.centerX || canvas.width / 2;
            const centerY = gradient.centerY || canvas.height / 2;
            const radius = gradient.radius || Math.min(canvas.width, canvas.height) / 2;
            canvasGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          }
          
          gradient.stops.forEach(stop => {
            canvasGradient.addColorStop(stop.offset, stop.color);
          });
          
          return canvasGradient;
        }
        return colorConfig.primary;
      
      case 'multi':
        // 对于多色模式，随机选择一个颜色
        if (colorConfig.multi && colorConfig.multi.length > 0) {
          const randomIndex = Math.floor(Math.random() * colorConfig.multi.length);
          return colorConfig.multi[randomIndex];
        }
        return colorConfig.primary;
      
      default:
        return colorConfig.primary;
    }
  }

  /**
   * 添加文字水印
   */
  private async addTextWatermark(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    settings: SimpleWatermarkSettings
  ): Promise<void> {
    const text = settings.text;
    if (!text || !text.content) return;
    
    // 设置字体
    const fontSize = Math.max(12, (text.font?.size || 24) * settings.position.scale);
    const fontFamily = text.font?.family || 'Arial, sans-serif';
    const fontWeight = text.font?.weight || 'normal';
    const fontStyle = text.font?.style || 'normal';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 设置颜色（支持渐变和多色）
    const fillStyle = this.createColorStyle(ctx, text.color || '#000000', canvas);
    ctx.fillStyle = fillStyle;
    
    // 根据placement类型处理不同的位置模式
    if (settings.position.placement === 'pattern' && settings.position.pattern) {
      this.addPatternWatermarks(ctx, canvas, text.content, settings);
    } else {
      // 单个水印的位置计算
      let x: number;
      let y: number;
      
      switch (settings.position.placement) {
        case 'center':
          x = canvas.width / 2;
          y = canvas.height / 2;
          break;
        case 'corner':
          const margin = 20;
          switch (settings.position.corner) {
            case 'top-left':
              x = margin;
              y = margin;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              break;
            case 'top-right':
              x = canvas.width - margin;
              y = margin;
              ctx.textAlign = 'right';
              ctx.textBaseline = 'top';
              break;
            case 'bottom-left':
              x = margin;
              y = canvas.height - margin;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              break;
            case 'bottom-right':
            default:
              x = canvas.width - margin;
              y = canvas.height - margin;
              ctx.textAlign = 'right';
              ctx.textBaseline = 'bottom';
              break;
          }
          break;
        default:
          x = canvas.width / 2;
          y = canvas.height / 2;
          break;
      }
      
      this.drawSingleWatermark(ctx, text.content, x, y, settings);
    }
  }
  
  /**
   * 绘制单个水印
   */
  private drawSingleWatermark(
    ctx: CanvasRenderingContext2D,
    content: string,
    x: number,
    y: number,
    settings: SimpleWatermarkSettings
  ): void {
    ctx.save();
    
    // 应用旋转
    if (settings.position.rotation) {
      ctx.translate(x, y);
      ctx.rotate((settings.position.rotation * Math.PI) / 180);
      x = 0;
      y = 0;
    }
    
    // 绘制文字（带阴影效果）
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 2;
    
    ctx.fillText(content, x, y);
    ctx.restore();
  }

  /**
   * 添加模式水印（平铺、三列、随机等）
   */
  private addPatternWatermarks(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    content: string,
    settings: SimpleWatermarkSettings
  ): void {
    const pattern = settings.position.pattern!;
    const positions: Array<{ x: number; y: number }> = [];

    switch (pattern.type) {
      case 'tiled-3-column':
        positions.push(...this.calculateTiledPositions(canvas, pattern, 3));
        break;
      case 'random':
        positions.push(...this.calculateRandomPositions(canvas, pattern));
        break;
      default:
        positions.push(...this.calculateDefaultPatternPositions(canvas, pattern));
        break;
    }

    // 绘制所有位置的水印
    positions.forEach(pos => {
      this.drawSingleWatermark(ctx, content, pos.x, pos.y, settings);
    });
  }

  /**
   * 计算三列平铺位置
   */
  private calculateTiledPositions(
    canvas: HTMLCanvasElement,
    pattern: { spacing: { x: number; y: number }; offset?: { x: number; y: number }; columns?: number; rows?: number },
    columns: number = 3
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const offsetX = pattern.offset?.x || 0;
    const offsetY = pattern.offset?.y || 0;
    const spacingY = pattern.spacing.y;
    
    // 计算可容纳的行数
    const availableWidth = canvas.width - 2 * offsetX;
    const availableHeight = canvas.height - 2 * offsetY;
    const rows = Math.floor(availableHeight / spacingY) || 1;
    
    // 计算列宽
    const columnWidth = availableWidth / columns;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = offsetX + col * columnWidth + columnWidth / 2;
        const y = offsetY + row * spacingY + spacingY / 2;
        
        if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
          positions.push({ x, y });
        }
      }
    }
    
    return positions;
  }

  /**
   * 计算随机位置
   */
  private calculateRandomPositions(
    canvas: HTMLCanvasElement,
    pattern: { 
      spacing: { x: number; y: number }; 
      offset?: { x: number; y: number }; 
      randomSeed?: number; 
      density?: number; 
      avoidOverlap?: boolean;
    }
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const density = pattern.density || 0.3;
    const seed = pattern.randomSeed || Date.now();
    const avoidOverlap = pattern.avoidOverlap !== false;
    
    // 简单的伪随机数生成器
    let random = this.createSeededRandom(seed);
    
    // 计算水印数量
    const totalArea = canvas.width * canvas.height;
    const watermarkArea = pattern.spacing.x * pattern.spacing.y;
    const maxWatermarks = Math.floor((totalArea * density) / watermarkArea);
    
    const margin = 50; // 边距
    const minDistance = avoidOverlap ? Math.min(pattern.spacing.x, pattern.spacing.y) : 0;
    
    for (let i = 0; i < maxWatermarks; i++) {
      let attempts = 0;
      let position: { x: number; y: number } | null = null;
      
      while (attempts < 50) { // 最大尝试50次
        const x = margin + random() * (canvas.width - 2 * margin);
        const y = margin + random() * (canvas.height - 2 * margin);
        
        // 检查是否与现有位置重叠
        if (!avoidOverlap || positions.every(pos => 
          Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2) > minDistance
        )) {
          position = { x, y };
          break;
        }
        attempts++;
      }
      
      if (position) {
        positions.push(position);
      }
    }
    
    return positions;
  }

  /**
   * 计算默认模式位置
   */
  private calculateDefaultPatternPositions(
    canvas: HTMLCanvasElement,
    pattern: { spacing: { x: number; y: number }; offset?: { x: number; y: number }; stagger?: boolean }
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const offsetX = pattern.offset?.x || 0;
    const offsetY = pattern.offset?.y || 0;
    const spacingX = pattern.spacing.x;
    const spacingY = pattern.spacing.y;
    const stagger = pattern.stagger || false;
    
    let y = offsetY;
    let rowIndex = 0;
    
    while (y <= canvas.height - spacingY / 2) {
      let x = offsetX;
      
      // 如果启用交错，奇数行偏移半个间距
      if (stagger && rowIndex % 2 === 1) {
        x += spacingX / 2;
      }
      
      while (x <= canvas.width - spacingX / 2) {
        positions.push({ x: x + spacingX / 2, y: y + spacingY / 2 });
        x += spacingX;
      }
      
      y += spacingY;
      rowIndex++;
    }
    
    return positions;
  }

  /**
   * 创建种子随机数生成器
   */
  private createSeededRandom(seed: number): () => number {
    let state = seed;
    return function() {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * Canvas转换为Blob
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement, 
    format: string, 
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas转换为Blob失败'));
          }
        },
        `image/${format}`,
        quality
      );
    });
  }
}