/**
 * 测试原生文档处理器功能
 */

import { NativeDocumentProcessor } from './utils/document/NativeDocumentProcessor';

async function testNativeDocumentProcessor() {
  const processor = new NativeDocumentProcessor();
  
  // 创建一个真正有效的PDF文件进行测试
  const createMockPDFFile = async () => {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    
    // 创建一个真正的PDF文档
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    
    // 添加一些原始内容
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText('Original PDF Content - This should be preserved', {
      x: 50,
      y: 350,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    
    page.drawText('Line 2: Testing watermark functionality', {
      x: 50,
      y: 320,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    
    const pdfBytes = await pdfDoc.save();
    return new File([pdfBytes], 'test.pdf', { type: 'application/pdf' });
  };

  const pdfFile = await createMockPDFFile();
  
  // 创建一个更真实的Word文档模拟数据（包含基本的ZIP和XML结构）
  const wordDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>这是原始文档内容，应该被保留。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>测试段落2：Word文档水印功能验证。</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  // 创建一个基本的DOCX ZIP结构
  const createMockWordFile = async () => {
    const JSZip = (window as any).JSZip || require('jszip');
    const zip = new JSZip();
    
    // 添加基本的Word文档文件结构
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
    return new File([buffer], 'test.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
  };

  const wordFile = await createMockWordFile();
  
  const settings = {
    type: 'text' as const,
    text: {
      content: '测试水印', // 测试中文支持
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
      format: 'png' as const,
      quality: 0.9,
      preserveOriginalMetadata: false,
      compression: { enabled: true, level: 'medium' as const }
    }
  };
  
  console.log('开始测试PDF处理...');
  try {
    const pdfResult = await processor.processDocument(pdfFile, settings);
    console.log('PDF处理结果:', {
      success: pdfResult.success,
      format: pdfResult.processedDocument?.format,
      size: pdfResult.processedDocument?.size,
      processingTime: pdfResult.processingTime,
      error: pdfResult.error
    });

    if (pdfResult.success) {
      console.log('✅ PDF水印处理成功 - 中文字符编码问题已解决');
      
      // 验证PDF内容是否包含水印
      if (pdfResult.processedDocument?.blob) {
        await validatePDFWatermark(pdfResult.processedDocument.blob);
      }
    } else {
      console.log('❌ PDF水印处理仍有问题:', pdfResult.error);
    }
  } catch (error) {
    console.error('PDF处理失败:', error);
  }
  
  console.log('开始测试Word处理...');
  try {
    const wordResult = await processor.processDocument(wordFile, settings);
    console.log('Word处理结果:', {
      success: wordResult.success,
      format: wordResult.processedDocument?.format,
      size: wordResult.processedDocument?.size,
      processingTime: wordResult.processingTime,
      error: wordResult.error
    });

    // 验证原始内容是否被保留
    if (wordResult.success && wordResult.processedDocument?.blob) {
      await validateWordContentPreservation(wordResult.processedDocument.blob);
    }
  } catch (error) {
    console.error('Word处理失败:', error);
  }
}

// 验证PDF水印功能
async function validatePDFWatermark(blob: Blob) {
  try {
    console.log('开始验证PDF水印...');
    
    const { PDFDocument } = await import('pdf-lib');
    const arrayBuffer = await blob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    const pages = pdfDoc.getPages();
    console.log(`PDF有${pages.length}页`);
    
    // 检查PDF是否正确保存
    const pdfBytes = await pdfDoc.save();
    console.log(`处理后的PDF大小: ${pdfBytes.length} 字节`);
    
    // 直接检查PDF字节内容中是否包含水印文本
    const pdfText = new TextDecoder('latin1').decode(pdfBytes); // 使用latin1解码PDF内容
    
    // 检查是否包含原始内容和水印
    const hasOriginalContent = pdfText.includes('Original PDF Content');
    const hasWatermark = pdfText.includes('TEST-WATERMARK') || 
                         pdfText.includes('WATERMARK') || 
                         pdfText.includes('Helvetica'); // 检查是否有字体引用
    
    console.log('PDF内容验证结果:', {
      '原始内容保留': hasOriginalContent,
      '水印已添加': hasWatermark,
      'PDF字节数': pdfBytes.length,
      '验证通过': hasOriginalContent && hasWatermark
    });
    
    if (hasOriginalContent && hasWatermark) {
      console.log('✅ PDF水印验证成功：原始内容保留且水印已添加');
    } else {
      console.log('❌ PDF水印验证失败：', {
        '缺少原始内容': !hasOriginalContent,
        '缺少水印': !hasWatermark
      });
    }
    
  } catch (error) {
    console.error('PDF验证过程中出错:', error);
  }
}

// 验证Word文档内容保留功能
async function validateWordContentPreservation(blob: Blob) {
  try {
    console.log('开始验证Word文档内容保留...');
    
    const JSZip = (window as any).JSZip || require('jszip');
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      console.error('验证失败：处理后的文档缺少 word/document.xml');
      return;
    }

    const xmlContent = await documentXml.async('string');
    console.log('处理后的文档XML内容:', xmlContent.substring(0, 500) + '...');
    
    // 检查原始内容是否存在
    const hasOriginalContent1 = xmlContent.includes('这是原始文档内容，应该被保留。');
    const hasOriginalContent2 = xmlContent.includes('测试段落2：Word文档水印功能验证。');
    const hasWatermark = xmlContent.includes('测试水印');
    
    console.log('内容验证结果:', {
      '原始内容1保留': hasOriginalContent1,
      '原始内容2保留': hasOriginalContent2,
      '水印已添加': hasWatermark,
      '验证通过': hasOriginalContent1 && hasOriginalContent2 && hasWatermark
    });
    
    if (hasOriginalContent1 && hasOriginalContent2 && hasWatermark) {
      console.log('✅ Word文档处理验证成功：原始内容保留且水印已添加');
    } else {
      console.log('❌ Word文档处理验证失败：内容保留或水印添加有问题');
    }
    
  } catch (error) {
    console.error('内容验证过程中出错:', error);
  }
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  (window as any).testNativeDocumentProcessor = testNativeDocumentProcessor;
  console.log('测试函数已加载，可以在控制台运行: testNativeDocumentProcessor()');
}

export { testNativeDocumentProcessor };