/**
 * 测试PDF中文水印支持
 * 验证使用fontkit后是否可以在PDF中显示中文水印
 */

import { NativeDocumentProcessor } from './utils/document/NativeDocumentProcessor';
import { SimpleWatermarkProcessor } from './utils/watermark/SimpleWatermarkProcessor';
import { ChineseFontLoader } from './utils/fonts/ChineseFontLoader';
import type { SimpleWatermarkSettings } from './utils/watermark/SimpleWatermarkProcessor';

// 中文测试设置
const chineseSettings: SimpleWatermarkSettings = {
  type: 'text',
  text: {
    content: '中文水印测试', // 中文水印
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
    format: 'pdf',
    quality: 1.0
  }
};

// 混合中英文测试设置
const mixedSettings: SimpleWatermarkSettings = {
  type: 'text',
  text: {
    content: 'CONFIDENTIAL 机密文件', // 中英文混合
    font: {
      family: 'Arial',
      size: 20,
      weight: 'normal'
    },
    color: '#0000FF'
  },
  position: {
    placement: 'pattern',
    opacity: 0.3,
    scale: 0.8,
    rotation: 45,
    pattern: {
      type: 'default',
      spacing: { x: 200, y: 150 }
    }
  },
  output: {
    format: 'pdf',
    quality: 1.0
  }
};

async function createTestPDF(): Promise<File> {
  // 创建一个简单的PDF文件用于测试
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF Content) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
298
%%EOF`;

  const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });
  return new File([pdfBlob], 'test-chinese.pdf', { type: 'application/pdf' });
}

async function testPDFChineseSupport() {
  console.log('🧪 开始测试PDF中文水印支持...\n');

  try {
    // 测试1: 检查fontkit依赖是否正常加载
    console.log('📋 测试1: Fontkit依赖检查');
    try {
      const fontkit = await import('@pdf-lib/fontkit');
      console.log('✅ @pdf-lib/fontkit 加载成功:', !!fontkit.default);
    } catch (error) {
      console.log('❌ @pdf-lib/fontkit 加载失败:', error);
      return;
    }

    // 测试2: 中文字符检测
    console.log('\n📋 测试2: 中文字符检测功能');
    const testTexts = [
      'WATERMARK',
      '水印测试',
      'CONFIDENTIAL 机密',
      '测试Test混合'
    ];

    for (const text of testTexts) {
      const hasChinese = ChineseFontLoader.containsChineseCharacters(text);
      console.log(`   "${text}" -> 包含中文: ${hasChinese ? '是' : '否'}`);
    }

    // 测试3: 字体加载功能
    console.log('\n📋 测试3: 字体加载功能测试');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const testDoc = await PDFDocument.create();
      
      // 测试英文字体
      const englishFont = await ChineseFontLoader.createPDFFont(testDoc, 'WATERMARK');
      console.log('✅ 英文字体创建成功:', !!englishFont);

      // 测试中文字体
      const chineseFont = await ChineseFontLoader.createPDFFont(testDoc, '水印测试');
      console.log('✅ 中文字体创建成功:', !!chineseFont);
      
    } catch (error) {
      console.log('❌ 字体加载测试失败:', error);
    }

    // 测试4: PDF处理器中文支持
    console.log('\n📋 测试4: PDF处理器中文水印测试');
    const docProcessor = new NativeDocumentProcessor();
    const testPDF = await createTestPDF();

    try {
      console.log('   处理中文水印PDF...');
      const result = await docProcessor.processDocument(testPDF, chineseSettings);
      
      if (result.success) {
        console.log('✅ PDF中文水印处理成功');
        console.log(`   文件大小: ${result.processedDocument?.size} bytes`);
        console.log(`   格式: ${result.processedDocument?.format}`);
        
        // 可以下载查看结果
        if (result.processedDocument?.dataUrl) {
          const downloadLink = document.createElement('a');
          downloadLink.href = result.processedDocument.dataUrl;
          downloadLink.download = 'chinese-watermark-test.pdf';
          downloadLink.textContent = '下载中文水印PDF';
          downloadLink.style.cssText = 'display: block; margin: 10px 0; padding: 8px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; text-align: center;';
          document.body.appendChild(downloadLink);
          console.log('   📥 下载链接已添加到页面');
        }
      } else {
        console.log('❌ PDF中文水印处理失败:', result.error);
      }
    } catch (error) {
      console.log('❌ PDF处理异常:', error);
    }

    // 测试5: 混合中英文水印
    console.log('\n📋 测试5: 混合中英文水印测试');
    try {
      console.log('   处理混合中英文水印PDF...');
      const mixedResult = await docProcessor.processDocument(testPDF, mixedSettings);
      
      if (mixedResult.success) {
        console.log('✅ 混合中英文水印处理成功');
        
        if (mixedResult.processedDocument?.dataUrl) {
          const downloadLink = document.createElement('a');
          downloadLink.href = mixedResult.processedDocument.dataUrl;
          downloadLink.download = 'mixed-watermark-test.pdf';
          downloadLink.textContent = '下载混合中英文水印PDF';
          downloadLink.style.cssText = 'display: block; margin: 10px 0; padding: 8px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; text-align: center;';
          document.body.appendChild(downloadLink);
          console.log('   📥 下载链接已添加到页面');
        }
      } else {
        console.log('❌ 混合中英文水印处理失败:', mixedResult.error);
      }
    } catch (error) {
      console.log('❌ 混合水印处理异常:', error);
    }

    // 测试6: SimpleWatermarkProcessor 中文支持
    console.log('\n📋 测试6: SimpleWatermarkProcessor中文支持测试');
    const watermarkProcessor = new SimpleWatermarkProcessor();
    
    try {
      // 创建测试图片
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#333';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('测试图片内容', 400, 300);
      
      const testImageBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      const testImageFile = new File([testImageBlob], 'test-image.png', { type: 'image/png' });

      // 测试PDF输出
      const pdfSettings = { ...chineseSettings, output: { format: 'pdf' as const, quality: 1.0 } };
      const pdfResult = await watermarkProcessor.processFile(testImageFile, pdfSettings);
      
      if (pdfResult.success) {
        console.log('✅ SimpleWatermarkProcessor PDF中文水印成功');
      } else {
        console.log('❌ SimpleWatermarkProcessor PDF处理失败:', pdfResult.error);
      }

    } catch (error) {
      console.log('❌ SimpleWatermarkProcessor测试异常:', error);
    }

  } catch (error) {
    console.error('💥 测试过程中发生严重错误:', error);
  }

  console.log('\n🏁 PDF中文水印支持测试完成!');
}

// 页面加载完成后运行测试
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // 添加测试按钮到页面
    const button = document.createElement('button');
    button.textContent = '🧪 测试PDF中文水印支持';
    button.style.cssText = `
      position: fixed; 
      top: 60px; 
      right: 10px; 
      z-index: 9999; 
      padding: 12px 16px; 
      background: #28a745; 
      color: white; 
      border: none; 
      border-radius: 6px; 
      cursor: pointer; 
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    button.onclick = testPDFChineseSupport;
    document.body.appendChild(button);
    
    console.log('✨ PDF中文水印测试按钮已添加到页面右上角');
  });
} else {
  // Node.js环境直接运行
  testPDFChineseSupport();
}

export { testPDFChineseSupport };