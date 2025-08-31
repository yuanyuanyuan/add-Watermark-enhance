/**
 * 文件处理 Hook
 * 管理文件上传、验证和处理状态
 * 基于架构文档的文件处理设计
 */

import { useState, useCallback, useRef } from 'react';
import type { SupportedImageFormat } from '@/types/app.types';

export interface FileProcessingStatus {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: any;
  startTime: number;
  endTime?: number;
}

export interface UseFileProcessorOptions {
  maxFiles?: number;
  maxFileSize?: number; // bytes
  acceptedFormats?: SupportedImageFormat[];
  onFileAdd?: (file: File) => void;
  onFileRemove?: (fileId: string) => void;
  onValidationError?: (file: File, errors: string[]) => void;
}

export interface UseFileProcessorReturn {
  files: Map<string, FileProcessingStatus>;
  selectedFiles: File[];
  isProcessing: boolean;
  totalProgress: number;
  errors: Map<string, string[]>;
  addFiles: (files: FileList | File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  processFile: (fileId: string, processor: (file: File) => Promise<any>) => Promise<void>;
  processAllFiles: (processor: (file: File) => Promise<any>) => Promise<void>;
  validateFile: (file: File) => string[];
  getFileById: (fileId: string) => FileProcessingStatus | undefined;
  getCompletedFiles: () => FileProcessingStatus[];
  getFailedFiles: () => FileProcessingStatus[];
}

export function useFileProcessor(options: UseFileProcessorOptions = {}): UseFileProcessorReturn {
  const {
    maxFiles = 10,
    maxFileSize = 100 * 1024 * 1024, // 100MB
    acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
    onFileAdd,
    onFileRemove,
    onValidationError
  } = options;

  const [files, setFiles] = useState<Map<string, FileProcessingStatus>>(new Map());
  const [errors, setErrors] = useState<Map<string, string[]>>(new Map());
  const fileIdCounter = useRef(0);

  const generateFileId = useCallback((): string => {
    return `file-${Date.now()}-${++fileIdCounter.current}`;
  }, []);

  const validateFile = useCallback((file: File): string[] => {
    const validationErrors: string[] = [];

    // 检查文件类型
    if (!acceptedFormats.includes(file.type as SupportedImageFormat)) {
      validationErrors.push(`不支持的文件格式: ${file.type}`);
    }

    // 检查文件大小
    if (file.size > maxFileSize) {
      const maxSizeMB = (maxFileSize / 1024 / 1024).toFixed(1);
      validationErrors.push(`文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB > ${maxSizeMB}MB`);
    }

    // 检查文件名
    if (!file.name || file.name.length === 0) {
      validationErrors.push('文件名不能为空');
    }

    return validationErrors;
  }, [acceptedFormats, maxFileSize]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    
    setFiles(prevFiles => {
      const updatedFiles = new Map(prevFiles);
      const newErrors = new Map(errors);

      // 检查文件数量限制
      if (updatedFiles.size + fileArray.length > maxFiles) {
        console.warn(`Cannot add files: would exceed maximum of ${maxFiles} files`);
        return prevFiles;
      }

      fileArray.forEach(file => {
        // 验证文件
        const validationErrors = validateFile(file);
        
        if (validationErrors.length > 0) {
          onValidationError?.(file, validationErrors);
          newErrors.set(file.name, validationErrors);
          return;
        }

        // 检查重复文件
        const isDuplicate = Array.from(updatedFiles.values()).some(
          fileStatus => fileStatus.file.name === file.name && fileStatus.file.size === file.size
        );

        if (isDuplicate) {
          console.warn(`Duplicate file ignored: ${file.name}`);
          return;
        }

        const fileId = generateFileId();
        const fileStatus: FileProcessingStatus = {
          id: fileId,
          file,
          status: 'pending',
          progress: 0,
          startTime: Date.now()
        };

        updatedFiles.set(fileId, fileStatus);
        onFileAdd?.(file);
      });

      setErrors(newErrors);
      return updatedFiles;
    });
  }, [maxFiles, validateFile, generateFileId, onFileAdd, onValidationError, errors]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prevFiles => {
      const updatedFiles = new Map(prevFiles);
      const fileStatus = updatedFiles.get(fileId);
      
      if (fileStatus) {
        updatedFiles.delete(fileId);
        onFileRemove?.(fileId);
      }
      
      return updatedFiles;
    });

    setErrors(prevErrors => {
      const updatedErrors = new Map(prevErrors);
      updatedErrors.delete(fileId);
      return updatedErrors;
    });
  }, [onFileRemove]);

  const clearFiles = useCallback(() => {
    files.forEach((_, fileId) => {
      onFileRemove?.(fileId);
    });
    
    setFiles(new Map());
    setErrors(new Map());
  }, [files, onFileRemove]);

  const updateFileStatus = useCallback((
    fileId: string,
    updates: Partial<FileProcessingStatus>
  ) => {
    setFiles(prevFiles => {
      const updatedFiles = new Map(prevFiles);
      const currentStatus = updatedFiles.get(fileId);
      
      if (currentStatus) {
        updatedFiles.set(fileId, { ...currentStatus, ...updates });
      }
      
      return updatedFiles;
    });
  }, []);

  const processFile = useCallback(async (
    fileId: string,
    processor: (file: File) => Promise<any>
  ): Promise<void> => {
    const fileStatus = files.get(fileId);
    if (!fileStatus) {
      throw new Error(`File not found: ${fileId}`);
    }

    updateFileStatus(fileId, { 
      status: 'processing',
      progress: 0,
      startTime: Date.now()
    });

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        const currentStatus = files.get(fileId);
        if (currentStatus) {
          updateFileStatus(fileId, {
            progress: Math.min(90, currentStatus.progress + Math.random() * 10)
          });
        }
      }, 200);

      const result = await processor(fileStatus.file);
      
      clearInterval(progressInterval);
      
      updateFileStatus(fileId, {
        status: 'completed',
        progress: 100,
        result,
        endTime: Date.now()
      });
    } catch (error) {
      updateFileStatus(fileId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Processing failed',
        endTime: Date.now()
      });
      throw error;
    }
  }, [files, updateFileStatus]);

  const processAllFiles = useCallback(async (
    processor: (file: File) => Promise<any>
  ): Promise<void> => {
    const fileIds = Array.from(files.keys()).filter(
      fileId => files.get(fileId)?.status === 'pending'
    );

    const processingPromises = fileIds.map(fileId => 
      processFile(fileId, processor).catch(error => {
        console.error(`Failed to process file ${fileId}:`, error);
      })
    );

    await Promise.all(processingPromises);
  }, [files, processFile]);

  const getFileById = useCallback((fileId: string) => {
    return files.get(fileId);
  }, [files]);

  const getCompletedFiles = useCallback(() => {
    return Array.from(files.values()).filter(file => file.status === 'completed');
  }, [files]);

  const getFailedFiles = useCallback(() => {
    return Array.from(files.values()).filter(file => file.status === 'failed');
  }, [files]);

  // 计算派生状态
  const selectedFiles = Array.from(files.values()).map(fileStatus => fileStatus.file);
  const isProcessing = Array.from(files.values()).some(file => file.status === 'processing');
  
  const totalProgress = files.size > 0 
    ? Array.from(files.values()).reduce((sum, file) => sum + file.progress, 0) / files.size
    : 0;

  return {
    files,
    selectedFiles,
    isProcessing,
    totalProgress,
    errors,
    addFiles,
    removeFile,
    clearFiles,
    processFile,
    processAllFiles,
    validateFile,
    getFileById,
    getCompletedFiles,
    getFailedFiles
  };
}