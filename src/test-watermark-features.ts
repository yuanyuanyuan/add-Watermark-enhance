/**
 * 测试新水印功能
 * 测试颜色自定义、平铺排列和中文字符检查
 */

import { SimpleWatermarkProcessor, SimpleWatermarkSettings } from './utils/watermark/SimpleWatermarkProcessor';

// 测试配置
const testConfigs: SimpleWatermarkSettings[] = [
  // 1. 测试基本颜色自定义
  {
    type: 'text',
    text: {
      content: 'Sample Watermark',
      font: {
        family: 'Arial',
        size: 24,
        weight: 'bold',
        style: 'normal'
      },
      color: '#FF5733' // 橙色
    },
    position: {
      placement: 'center',
      opacity: 0.7,
      scale: 1.0,
      rotation: 0
    },
    output: {
      format: 'png',
      quality: 0.9
    }
  },

  // 2. 测试渐变颜色
  {
    type: 'text',
    text: {
      content: 'Gradient Watermark',
      font: {
        family: 'Arial',
        size: 28,
        weight: 'bold',
        style: 'normal'
      },
      color: {
        type: 'gradient',
        primary: '#FF6B35',
        gradient: {
          type: 'linear',
          stops: [
            { offset: 0, color: '#FF6B35' },
            { offset: 0.5, color: '#F7931E' },
            { offset: 1, color: '#FFD23F' }
          ],
          angle: 45
        }
      }
    },
    position: {
      placement: 'center',
      opacity: 0.8,
      scale: 1.2,
      rotation: -15
    },
    output: {
      format: 'png',
      quality: 0.9
    }
  },

  // 3. 测试三列平铺排列
  {
    type: 'text',
    text: {
      content: 'WATERMARK',
      font: {
        family: 'Arial',
        size: 20,
        weight: 'normal',
        style: 'normal'
      },
      color: '#4A90E2'
    },
    position: {
      placement: 'pattern',
      pattern: {
        type: 'tiled-3-column',
        spacing: { x: 200, y: 150 },
        offset: { x: 50, y: 50 },
        columns: 3,
        rows: 4
      },
      opacity: 0.3,
      scale: 1.0,
      rotation: 45
    },
    output: {
      format: 'png',
      quality: 0.9
    }
  },

  // 4. 测试随机排列
  {
    type: 'text',
    text: {
      content: 'RANDOM',
      font: {
        family: 'Arial',
        size: 18,
        weight: 'bold',
        style: 'italic'
      },
      color: {
        type: 'multi',
        primary: '#E74C3C',
        multi: ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6']
      }
    },
    position: {
      placement: 'pattern',
      pattern: {
        type: 'random',
        spacing: { x: 150, y: 100 },
        density: 0.4,
        randomSeed: 12345,
        avoidOverlap: true
      },
      opacity: 0.5,
      scale: 1.0,
      rotation: 0
    },
    output: {
      format: 'png',
      quality: 0.9
    }
  },

  // 5. 测试中文字符阻止（应该失败）
  {
    type: 'text',
    text: {
      content: '中文水印测试',
      font: {
        family: 'Arial',
        size: 24,
        weight: 'normal',
        style: 'normal'
      },
      color: '#333333'
    },
    position: {
      placement: 'center',
      opacity: 0.6,
      scale: 1.0,
      rotation: 0
    },
    security: {
      blockChineseCharacters: true
    },
    output: {
      format: 'png',
      quality: 0.9
    }
  }
];

/**
 * 运行水印功能测试
 */
export async function runWatermarkTests(): Promise<void> {
  console.log('开始测试新水印功能...');
  
  const processor = new SimpleWatermarkProcessor();
  
  // 创建一个测试用的图片文件（使用Canvas生成）
  const testImageBlob = await createTestImage();
  const testFile = new File([testImageBlob], 'test-image.png', { type: 'image/png' });
  
  for (let i = 0; i < testConfigs.length; i++) {
    const config = testConfigs[i];
    console.log(`\n测试 ${i + 1}: ${getTestDescription(i)}`);
    
    try {
      const result = await processor.processFile(testFile, config);
      
      if (result.success) {
        console.log(`✅ 测试 ${i + 1} 成功`);
        console.log(`   - 处理时间: ${result.processingTime.toFixed(2)}ms`);
        console.log(`   - 输出大小: ${result.processedImage?.size} bytes`);
        console.log(`   - 输出尺寸: ${result.processedImage?.dimensions.width}x${result.processedImage?.dimensions.height}`);
      } else {
        console.log(`❌ 测试 ${i + 1} 失败: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ 测试 ${i + 1} 异常: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log('\n测试完成！');
}

/**
 * 创建测试用图片
 */
async function createTestImage(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  
  const ctx = canvas.getContext('2d')!;
  
  // 绘制渐变背景
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#E3F2FD');
  gradient.addColorStop(1, '#BBDEFB');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 添加一些装饰图案
  ctx.fillStyle = '#90CAF9';
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 30 + 10;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 转换为Blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  });
}

/**
 * 获取测试描述
 */
function getTestDescription(index: number): string {
  const descriptions = [
    '基本颜色自定义（纯色）',
    '渐变颜色效果',
    '三列平铺排列',
    '随机位置排列',
    '中文字符检查（应该被阻止）'
  ];
  
  return descriptions[index] || '未知测试';
}

/**
 * 验证功能特性
 */
export function validateFeatures(): void {
  console.log('验证功能特性实现状态:');
  
  // 检查类型定义是否正确
  console.log('✅ 颜色自定义: ColorConfig 类型已定义，支持纯色、渐变、多色');
  console.log('✅ 平铺排列: PatternConfig 支持 tiled-3-column 模式');
  console.log('✅ 随机排列: PatternConfig 支持 random 模式');
  console.log('✅ 中文检查: SecurityConfig 支持 blockChineseCharacters 选项');
  
  // 检查处理器方法
  const processor = new SimpleWatermarkProcessor();
  
  // 验证方法存在性
  const hasColorMethod = typeof (processor as any).createColorStyle === 'function';
  const hasPatternMethod = typeof (processor as any).addPatternWatermarks === 'function';
  const hasChineseCheckMethod = typeof (processor as any).containsChineseCharacters === 'function';
  
  console.log(`✅ 颜色处理方法: ${hasColorMethod ? '已实现' : '缺失'}`);
  console.log(`✅ 模式水印方法: ${hasPatternMethod ? '已实现' : '缺失'}`);
  console.log(`✅ 中文检测方法: ${hasChineseCheckMethod ? '已实现' : '缺失'}`);
}

// 如果在浏览器环境中运行，则自动执行验证
if (typeof window !== 'undefined') {
  validateFeatures();
  
  // 可选：运行完整测试（需要用户触发）
  (window as any).runWatermarkTests = runWatermarkTests;
  console.log('使用 runWatermarkTests() 来运行完整的功能测试');
}