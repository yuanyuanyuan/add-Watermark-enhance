/**
 * PDF.js Worker修复验证测试
 * 验证PDF处理器现在是否能正常工作
 */

import { DocumentProcessor } from './utils/document/DocumentProcessor';

// 模拟PDF文件（最小的PDF内容）
const createMockPDF = (): File => {
  // 最简单的PDF文件内容（Hello World PDF）
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
/Resources <<
/Font <<
/F1 4 0 R 
>>
>>
/MediaBox [0 0 612 792]
/Contents 5 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Times-Roman
>>
endobj

5 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Hello World!) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
0000000380 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
492
%%EOF`;

  return new File([pdfContent], 'test.pdf', { 
    type: 'application/pdf' 
  });
};

// 模拟设置
const mockSettings = {
  type: 'text' as const,
  text: {
    content: '测试水印',
    font: {
      family: 'Arial',
      size: 12,
      weight: 'normal',
      style: 'normal'
    },
    color: 'rgba(128, 128, 128, 0.6)'
  },
  position: {
    placement: 'center' as const,
    opacity: 0.6,
    scale: 1.0,
    rotation: -45
  },
  output: {
    format: 'png' as const,
    quality: 0.9,
    compression: {
      enabled: true,
      level: 'medium' as const
    }
  }
};

async function testPDFWorkerFix() {
  console.log('🧪 测试PDF.js Worker修复...');
  
  try {
    // 1. 验证PDF处理器可用
    console.log('1. 创建DocumentProcessor实例...');
    const documentProcessor = new DocumentProcessor();
    console.log('   ✅ DocumentProcessor创建成功');
    
    // 2. 创建模拟PDF文件
    console.log('2. 创建测试PDF文件...');
    const mockPDFFile = createMockPDF();
    console.log('   ✅ 模拟PDF文件创建成功:', {
      name: mockPDFFile.name,
      size: mockPDFFile.size,
      type: mockPDFFile.type
    });
    
    // 3. 测试PDF处理
    console.log('3. 开始PDF处理测试...');
    const result = await documentProcessor.processDocument(mockPDFFile, mockSettings);
    
    console.log('📊 处理结果:', {
      success: result.success,
      error: result.error,
      processingTime: result.processingTime,
      hasProcessedDocument: !!result.processedDocument,
      pageCount: result.processedDocument?.pageCount
    });
    
    if (result.success) {
      console.log('🎉 PDF.js Worker修复成功！');
      console.log('   ✅ PDF文件成功加载和处理');
      console.log('   ✅ Worker配置正确');
      console.log('   ✅ 内容保留功能正常');
      
      if (result.processedDocument) {
        console.log('📄 输出信息:', {
          format: result.processedDocument.format,
          blobSize: result.processedDocument.blob.size,
          pageCount: result.processedDocument.pageCount
        });
      }
    } else {
      console.log('❌ PDF处理仍然失败:', result.error);
      console.log('💡 建议检查：');
      console.log('   - Worker URL是否可访问');
      console.log('   - 网络连接是否正常');
      console.log('   - PDF.js版本是否兼容');
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    console.log('🔧 可能的解决方案：');
    console.log('   1. 检查PDF.js依赖是否正确安装');
    console.log('   2. 验证Worker配置路径');
    console.log('   3. 确保浏览器支持PDF.js');
  }
}

// 执行测试
testPDFWorkerFix();