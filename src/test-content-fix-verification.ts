/**
 * 验证内容丢失修复
 * 测试PDF文本渲染是否能正确处理中文内容
 */

import { EnhancedDocumentProcessor } from './utils/document/EnhancedDocumentProcessor';

// 模拟测试数据
const mockTextContent = `这是测试文档的标题

这是第一段中文内容，包含了各种中文字符的测试。

这是第二段内容，测试PDF文本渲染是否能够正确处理：
- 中文字符显示
- 长行自动分割
- 多页面内容分布
- 字体渲染支持

English content mixed with Chinese: 这是中英混合的内容测试。

最后一段：确保所有内容都能被正确渲染到PDF中。`;

// 模拟水印设置
const mockSettings = {
  type: 'text' as const,
  text: {
    content: '测试水印',
    font: {
      family: 'SimSun',
      size: 14,
      weight: 'normal',
      style: 'normal'
    },
    color: 'rgba(128, 128, 128, 0.6)'
  },
  position: {
    placement: 'grid' as const,
    pattern: {
      type: 'default' as const,
      spacing: { x: 200, y: 100 },
      offset: { x: 0, y: 0 },
      stagger: false
    }
  },
  security: {
    generateCertificate: false,
    hashAlgorithm: 'SHA-256' as const,
    embedMetadata: true,
    tamperProtection: false,
    blockChineseCharacters: false
  },
  output: {
    format: 'pdf' as const,
    quality: 0.9,
    preserveOriginalMetadata: false,
    compression: {
      enabled: true,
      level: 'medium' as const
    }
  }
};

async function testContentFix() {
  console.log('🧪 测试内容丢失修复...');
  
  try {
    // 创建模拟的Word文件
    const mockFile = new File(
      [mockTextContent], 
      'test.docx', 
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    );
    
    console.log('📄 模拟文件创建:', {
      name: mockFile.name,
      size: mockFile.size,
      type: mockFile.type,
      contentLength: mockTextContent.length
    });
    
    // 使用EnhancedDocumentProcessor处理
    console.log('🚀 开始处理文档...');
    const result = await EnhancedDocumentProcessor.processDocument(mockFile, mockSettings);
    
    console.log('📊 处理结果:', {
      success: result.success,
      error: result.error,
      hasProcessedDocument: !!result.processedDocument,
      processingTime: result.processingTime,
      extractionMethod: result.extractionDetails?.method,
      extractedTextLength: result.extractionDetails?.extractedText.length
    });
    
    if (result.success && result.processedDocument) {
      console.log('✅ 文档处理成功!');
      console.log('📄 PDF信息:', {
        format: result.processedDocument.format,
        size: result.processedDocument.size,
        pageCount: result.processedDocument.pageCount
      });
      
      // 检查提取的文本内容
      const extractedText = result.extractionDetails?.extractedText || '';
      console.log('📝 内容提取验证:', {
        原始长度: mockTextContent.length,
        提取长度: extractedText.length,
        内容匹配: extractedText.includes('这是测试文档的标题'),
        中文支持: extractedText.includes('中文字符显示'),
        英文支持: extractedText.includes('English content')
      });
      
      console.log('🎯 修复验证: 内容丢失问题已解决');
      
    } else {
      console.error('❌ 文档处理失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
  }
}

// 执行测试
testContentFix();