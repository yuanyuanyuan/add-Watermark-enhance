/**
 * 文档预览组件 - 支持PDF和Word文档的水印预览
 */

import React, { useState, useEffect } from 'react';

interface DocumentPreviewProps {
  file: File;
  dataUrl: string;
  format: string;
  className?: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
  file, 
  dataUrl, 
  format, 
  className = '' 
}) => {
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isPDF = format === 'pdf' || file.type === 'application/pdf';
  const isWord = format === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  useEffect(() => {
    // 模拟加载时间
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [dataUrl]);

  const handlePreviewError = () => {
    setPreviewError('预览加载失败');
    setIsLoading(false);
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return '📄';
    if (file.type === 'application/msword' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.doc') ||
        file.name.toLowerCase().endsWith('.docx')) return '📝';
    return '📁';
  };

  const getFileType = (file: File) => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF';
    if (file.type === 'application/msword' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.doc') ||
        file.name.toLowerCase().endsWith('.docx')) return 'Word';
    return '文档';
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">{getFileIcon(file)}</div>
          <div className="text-sm text-gray-500">正在生成预览...</div>
        </div>
      </div>
    );
  }

  if (previewError) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-2 text-gray-400">❌</div>
          <div className="text-sm text-gray-500">{previewError}</div>
        </div>
      </div>
    );
  }

  // PDF预览
  if (isPDF) {
    return (
      <div className={`${className} bg-white border rounded`}>
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <span className="text-2xl mr-2">📄</span>
            <span className="text-sm font-medium">PDF预览（含水印）</span>
          </div>
        </div>
        <div className="p-4">
          <iframe
            src={dataUrl}
            className="w-full h-96 border-0"
            title="PDF Preview"
            onError={handlePreviewError}
          />
        </div>
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-500">
            ✅ 水印已成功添加到PDF文档中
          </div>
        </div>
      </div>
    );
  }

  // Word文档预览（显示信息卡片）
  if (isWord) {
    return (
      <div className={`${className} bg-white border rounded`}>
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <span className="text-2xl mr-2">📝</span>
            <span className="text-sm font-medium">Word文档（含水印）</span>
          </div>
        </div>
        <div className="p-6 text-center">
          <div className="text-8xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {file.name}
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ 水印已添加
              </span>
            </div>
            <p>文档格式：{getFileType(file)}</p>
            <p>大小：{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600">
                💡 Word文档支持原生中文水印，下载后用Office或WPS打开可查看完整效果
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 通用文档预览
  return (
    <div className={`${className} bg-white border rounded`}>
      <div className="p-6 text-center">
        <div className="text-8xl mb-4">{getFileIcon(file)}</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {file.name}
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✅ 已处理
            </span>
          </div>
          <p>文档格式：{getFileType(file)}</p>
          <p>大小：{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      </div>
    </div>
  );
};