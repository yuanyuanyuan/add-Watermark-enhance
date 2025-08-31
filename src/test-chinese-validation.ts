/**
 * 测试中文字符自动阻止功能
 * 验证在PDF输出时自动检测并阻止中文字符
 */

import { SimpleWatermarkProcessor } from './utils/watermark/SimpleWatermarkProcessor';
import { NativeDocumentProcessor } from './utils/document/NativeDocumentProcessor';
import type { SimpleWatermarkSettings } from './utils/watermark/SimpleWatermarkProcessor';

// 测试设置 - 包含中文字符
const chineseWatermarkSettings: SimpleWatermarkSettings = {
  type: 'text',
  text: {
    content: '水印测试', // 中文字符
    font: {
      family: 'Arial',
      size: 24,
      weight: 'normal'
    },
    color: '#FF0000'
  },
  position: {
    placement: 'center',
    opacity: 0.5,
    scale: 1.0,
    rotation: 0
  },
  output: {
    format: 'pdf', // PDF格式应该被阻止
    quality: 1.0
  }
};

// 测试设置 - 英文字符
const englishWatermarkSettings: SimpleWatermarkSettings = {
  type: 'text',
  text: {
    content: 'WATERMARK', // 英文字符
    font: {
      family: 'Arial',
      size: 24,
      weight: 'normal'
    },
    color: '#FF0000'
  },
  position: {
    placement: 'center',
    opacity: 0.5,
    scale: 1.0,
    rotation: 0
  },
  output: {
    format: 'pdf', // PDF格式应该通过
    quality: 1.0
  }
};

async function testChineseValidation() {
  console.log('🧪 开始测试中文字符自动阻止功能...\n');

  const processor = new SimpleWatermarkProcessor();
  const docProcessor = new NativeDocumentProcessor();

  // 测试1: SimpleWatermarkProcessor 中文字符阻止
  console.log('📋 测试1: SimpleWatermarkProcessor PDF输出中文字符阻止');
  try {
    // 创建一个测试用的图片文件
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 400, 300);
    
    const testImageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
    const testImageFile = new File([testImageBlob], 'test-image.png', { type: 'image/png' });

    await processor.processFile(testImageFile, chineseWatermarkSettings);
    console.log('❌ 错误: 应该阻止中文字符但未阻止');
  } catch (error) {
    if (error instanceof Error && error.message.includes('PDF格式不支持中文字符')) {
      console.log('✅ 通过: 正确阻止了中文字符');
      console.log(`   错误信息: ${error.message}`);
    } else {
      console.log('❌ 失败: 阻止了但错误信息不正确');
      console.log(`   错误信息: ${error}`);
    }
  }

  // 测试2: SimpleWatermarkProcessor 英文字符通过
  console.log('\n📋 测试2: SimpleWatermarkProcessor PDF输出英文字符通过');
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 400, 300);
    
    const testImageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
    const testImageFile = new File([testImageBlob], 'test-image.png', { type: 'image/png' });

    const result = await processor.processFile(testImageFile, englishWatermarkSettings);
    if (result.success) {
      console.log('✅ 通过: 英文字符正常处理');
    } else {
      console.log('❌ 失败: 英文字符处理失败');
      console.log(`   错误信息: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ 失败: 英文字符处理出现异常');
    console.log(`   错误信息: ${error}`);
  }

  // 测试3: NativeDocumentProcessor PDF中文字符阻止
  console.log('\n📋 测试3: NativeDocumentProcessor PDF中文字符阻止');
  try {
    // 创建测试用的PDF文件（模拟）
    const testPdfBlob = new Blob(['%PDF-1.4\ntest content'], { type: 'application/pdf' });
    const testPdfFile = new File([testPdfBlob], 'test.pdf', { type: 'application/pdf' });

    await docProcessor.processDocument(testPdfFile, chineseWatermarkSettings);
    console.log('❌ 错误: 应该阻止中文字符但未阻止');
  } catch (error) {
    if (error instanceof Error && error.message.includes('PDF格式不支持中文字符')) {
      console.log('✅ 通过: 正确阻止了中文字符');
      console.log(`   错误信息: ${error.message}`);
    } else {
      console.log('❌ 失败: 阻止了但错误信息不正确');
      console.log(`   错误信息: ${error}`);
    }
  }

  // 测试4: NativeDocumentProcessor Word转PDF中文字符阻止
  console.log('\n📋 测试4: NativeDocumentProcessor Word转PDF中文字符阻止');
  try {
    // 创建测试用的Word文件（模拟）
    const testWordBlob = new Blob(['test word content'], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const testWordFile = new File([testWordBlob], 'test.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });

    await docProcessor.processWordToPDF(testWordFile, chineseWatermarkSettings);
    console.log('❌ 错误: 应该阻止中文字符但未阻止');
  } catch (error) {
    if (error instanceof Error && error.message.includes('PDF格式不支持中文字符')) {
      console.log('✅ 通过: 正确阻止了中文字符');
      console.log(`   错误信息: ${error.message}`);
    } else {
      console.log('❌ 失败: 阻止了但错误信息不正确');
      console.log(`   错误信息: ${error}`);
    }
  }

  // 测试5: 非PDF格式允许中文字符
  console.log('\n📋 测试5: 非PDF格式允许中文字符');
  const pngSettings: SimpleWatermarkSettings = {
    ...chineseWatermarkSettings,
    output: {
      format: 'png', // PNG格式应该允许中文字符
      quality: 1.0
    }
  };

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 400, 300);
    
    const testImageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
    const testImageFile = new File([testImageBlob], 'test-image.png', { type: 'image/png' });

    const result = await processor.processFile(testImageFile, pngSettings);
    if (result.success) {
      console.log('✅ 通过: PNG格式允许中文字符');
    } else {
      console.log('❌ 失败: PNG格式应该允许中文字符');
      console.log(`   错误信息: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ 失败: PNG格式处理异常');
    console.log(`   错误信息: ${error}`);
  }

  console.log('\n🏁 测试完成!');
}

// 页面加载完成后运行测试
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // 添加测试按钮到页面
    const button = document.createElement('button');
    button.textContent = '运行中文字符验证测试';
    button.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
    button.onclick = testChineseValidation;
    document.body.appendChild(button);
    
    console.log('✨ 测试按钮已添加到页面右上角');
  });
} else {
  // Node.js环境直接运行
  testChineseValidation();
}

export { testChineseValidation };