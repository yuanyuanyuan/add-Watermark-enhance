/**
 * 文件上传组件
 * 支持拖拽上传和文件选择
 */

import React, { useCallback, useState } from 'react';
import type { FileUploaderProps } from '@/types/app.types';
import { Button } from '@/components/ui/Button';

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelect,
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024,
  acceptedFormats = ['image/*', '.pdf', '.doc', '.docx', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      // 检查文件类型
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isWord = file.type === 'application/msword' || 
                     file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                     file.name.toLowerCase().endsWith('.doc') ||
                     file.name.toLowerCase().endsWith('.docx');
      
      return (isImage || isPDF || isWord) && file.size <= maxFileSize;
    });
    
    if (validFiles.length > 0) {
      onFilesSelect(validFiles.slice(0, maxFiles));
    }
  }, [onFilesSelect, maxFiles, maxFileSize]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(file => {
        // 检查文件类型
        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isWord = file.type === 'application/msword' || 
                       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       file.name.toLowerCase().endsWith('.doc') ||
                       file.name.toLowerCase().endsWith('.docx');
        
        return (isImage || isPDF || isWord) && file.size <= maxFileSize;
      });
      
      if (validFiles.length > 0) {
        onFilesSelect(validFiles.slice(0, maxFiles));
      }
    }
  }, [onFilesSelect, maxFiles, maxFileSize]);

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="text-6xl text-gray-400">📁</div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              拖拽文件到此处或点击选择文件
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              支持图片（JPG、PNG、WebP）和文档（PDF、Word）格式，最大 {Math.round(maxFileSize / 1024 / 1024)}MB
            </p>
          </div>
          <div>
            <Button variant="outline" onClick={() => document.getElementById('file-input')?.click()}>
              选择文件
            </Button>
            <input
              id="file-input"
              type="file"
              multiple
              accept={acceptedFormats.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};