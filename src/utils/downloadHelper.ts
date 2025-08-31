/**
 * 下载助手工具
 * 提供文件下载功能
 */

/**
 * 下载单个文件
 */
export const downloadFile = (dataUrl: string, filename: string): void => {
  try {
    // 创建临时链接元素
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    
    // 添加到文档并触发点击
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download failed:', error);
    alert('下载失败，请重试');
  }
};

/**
 * 生成带水印的文件名
 */
export const generateWatermarkedFilename = (originalFilename: string, format?: string): string => {
  const lastDotIndex = originalFilename.lastIndexOf('.');
  
  if (lastDotIndex === -1) {
    // 没有扩展名
    const extension = format ? `.${format}` : '';
    return `${originalFilename}_watermarked${extension}`;
  }
  
  const nameWithoutExt = originalFilename.substring(0, lastDotIndex);
  const originalExtension = originalFilename.substring(lastDotIndex);
  
  // 如果指定了格式，使用指定格式的扩展名
  if (format) {
    let newExtension: string;
    switch (format.toLowerCase()) {
      case 'pdf':
        newExtension = '.pdf';
        break;
      case 'docx':
        newExtension = '.docx';
        break;
      case 'png':
        newExtension = '.png';
        break;
      case 'jpeg':
      case 'jpg':
        newExtension = '.jpg';
        break;
      case 'webp':
        newExtension = '.webp';
        break;
      default:
        newExtension = originalExtension;
        break;
    }
    return `${nameWithoutExt}_watermarked${newExtension}`;
  }
  
  return `${nameWithoutExt}_watermarked${originalExtension}`;
};

/**
 * 批量下载文件（使用ZIP压缩）
 * 注意：这里使用简单的方式逐个下载，避免引入额外的ZIP库
 */
export const downloadMultipleFiles = async (
  files: Array<{ dataUrl: string; filename: string }>
): Promise<void> => {
  if (files.length === 0) {
    alert('没有可下载的文件');
    return;
  }

  if (files.length === 1) {
    // 单个文件直接下载
    downloadFile(files[0].dataUrl, files[0].filename);
    return;
  }

  // 多个文件逐个下载（延迟500ms避免浏览器阻止）
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    setTimeout(() => {
      downloadFile(file.dataUrl, file.filename);
    }, i * 500);
  }
  
  alert(`正在下载 ${files.length} 个文件，请注意浏览器下载提示`);
};

/**
 * 检查浏览器下载支持
 */
export const checkDownloadSupport = (): boolean => {
  const link = document.createElement('a');
  return typeof link.download !== 'undefined';
};