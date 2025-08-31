/**
 * Word转PDF功能测试脚本
 */

import { NativeDocumentProcessor } from './utils/document/NativeDocumentProcessor';

async function testWordToPDFConversion() {
  console.log('🧪 开始测试 Word转PDF 功能...');
  
  const processor = new NativeDocumentProcessor();
  
  // 创建一个基本的Word文档模拟数据
  const wordDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>这是测试Word文档的内容。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Word转PDF功能验证测试。</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  // 创建Word文件
  const createMockWordFile = async () => {
    const JSZip = (window as any).JSZip || await import('jszip');
    const zip = new JSZip();
    
    zip.file('word/document.xml', wordDocumentXml);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    return new File([buffer], 'test-word-to-pdf.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
  };

  const wordFile = await createMockWordFile();
  console.log('✅ Word文件创建成功:', wordFile.name, wordFile.size + ' bytes');
  
  // 水印设置
  const settings = {
    type: 'text' as const,
    text: {
      content: 'TEST WATERMARK',
      font: { family: 'Arial', size: 32, weight: 'normal' as const, style: 'normal' as const },
      color: '#FF0000'
    },
    position: {
      placement: 'center' as const,
      corner: 'bottom-right' as const,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      opacity: 0.7,
      scale: 1.0,
      rotation: 0,
      blendMode: 'normal' as const
    },
    output: {
      format: 'pdf' as const, // 关键：输出PDF格式
      quality: 0.9,
      preserveOriginalMetadata: false,
      compression: { enabled: true, level: 'medium' as const }
    }
  };
  
  try {
    console.log('🔄 开始Word转PDF处理...');
    const result = await processor.processWordToPDF(wordFile, settings);
    
    console.log('📊 处理结果:', {
      success: result.success,
      format: result.processedDocument?.format,
      size: result.processedDocument?.size,
      processingTime: result.processingTime,
      error: result.error
    });

    if (result.success && result.processedDocument) {
      console.log('✅ Word转PDF成功！');
      console.log('📄 生成的PDF大小:', result.processedDocument.size + ' bytes');
      console.log('⏱️ 处理时间:', Math.round(result.processingTime) + 'ms');
      
      // 验证PDF是否有效
      if (result.processedDocument.blob && result.processedDocument.dataUrl) {
        console.log('✅ PDF Blob和DataURL都已生成');
        console.log('🔗 DataURL长度:', result.processedDocument.dataUrl.length);
        
        // 可以通过dataUrl在浏览器中预览
        console.log('💡 可以将dataUrl复制到浏览器地址栏查看PDF效果');
      }
      
    } else {
      console.error('❌ Word转PDF失败:', result.error);
    }
    
  } catch (error) {
    console.error('🚨 测试过程中发生错误:', error);
  }
  
  console.log('🏁 Word转PDF功能测试完成');
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  (window as any).testWordToPDFConversion = testWordToPDFConversion;
  console.log('Word转PDF测试函数已加载，可以在控制台运行: testWordToPDFConversion()');
}

export { testWordToPDFConversion };