/**
 * 水印增强产品主应用
 * 基于架构文档的应用设计
 */

import React, { useEffect } from 'react';
import { useWatermarkStore } from '@/stores/watermarkStore';
import { FileUploader } from '@/components/business/FileUploader';
import { DocumentPreview } from '@/components/business/DocumentPreview';
import { Button } from '@/components/ui/Button';
import { downloadFile, downloadMultipleFiles, generateWatermarkedFilename, checkDownloadSupport } from '@/utils/downloadHelper';
// 开发时引入测试功能
import './test-chinese-validation';
import './test-pdf-chinese-support';

const App: React.FC = () => {
  const {
    files,
    watermark,
    ui,
    selectFiles,
    processFiles,
    clearFiles,
    updateWatermarkSettings,
    setActiveView,
    initializeCanvas
  } = useWatermarkStore();

  useEffect(() => {
    // 初始化应用
    initializeCanvas();
  }, [initializeCanvas]);

  const handleFilesSelect = (newFiles: File[]) => {
    selectFiles(newFiles);
    if (newFiles.length > 0) {
      setActiveView('editor');
    }
  };

  const handleProcess = async () => {
    try {
      await processFiles(watermark.settings);
    } catch (error) {
      console.error('Processing failed:', error);
    }
  };

  const handleClearFiles = () => {
    clearFiles();
    setActiveView('upload');
  };

  const handleDownloadSingle = (result: any) => {
    if (!result.success || !result.processedImage.dataUrl) {
      alert('该文件处理失败，无法下载');
      return;
    }

    if (!checkDownloadSupport()) {
      alert('您的浏览器不支持文件下载功能');
      return;
    }

    const filename = generateWatermarkedFilename(result.originalFile.name, result.processedImage.format);
    downloadFile(result.processedImage.dataUrl, filename);
  };

  const handleDownloadAll = async () => {
    const successfulResults = Array.from(files.results.entries())
      .filter(([, result]) => result.success && result.processedImage.dataUrl)
      .map(([, result]) => ({
        dataUrl: result.processedImage.dataUrl,
        filename: generateWatermarkedFilename(result.originalFile.name, result.processedImage.format)
      }));

    if (successfulResults.length === 0) {
      alert('没有成功处理的文件可供下载');
      return;
    }

    if (!checkDownloadSupport()) {
      alert('您的浏览器不支持文件下载功能');
      return;
    }

    await downloadMultipleFiles(successfulResults);
  };

  const renderUploadView = () => (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          水印增强产品
        </h1>
        <p className="text-gray-600">
          支持图片和文档水印处理，包括 PDF、Word 文档，100% 浏览器端处理，无需上传到服务器
        </p>
      </div>

      <FileUploader
        onFilesSelect={handleFilesSelect}
        maxFiles={10}
        maxFileSize={100 * 1024 * 1024}
        acceptedFormats={['image/*', '.pdf', '.doc', '.docx', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
      />
    </div>
  );

  const renderEditorView = () => (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          水印编辑器
        </h2>
        <div className="space-x-4">
          <Button variant="outline" onClick={handleClearFiles}>
            重新选择
          </Button>
          <Button
            variant="primary"
            onClick={handleProcess}
            loading={ui.loading}
            disabled={files.selected.length === 0}
          >
            开始处理
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 文件列表 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 mb-4">
              已选文件 ({files.selected.length})
            </h3>
            <div className="space-y-2">
              {files.selected.map((file, index) => {
                const getFileIcon = (file: File) => {
                  if (file.type.startsWith('image/')) return '🖼️';
                  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return '📄';
                  if (file.type === 'application/msword' || 
                      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                      file.name.toLowerCase().endsWith('.doc') ||
                      file.name.toLowerCase().endsWith('.docx')) return '📝';
                  return '📁';
                };

                const getFileType = (file: File) => {
                  if (file.type.startsWith('image/')) return '图片';
                  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF';
                  if (file.type === 'application/msword' || 
                      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                      file.name.toLowerCase().endsWith('.doc') ||
                      file.name.toLowerCase().endsWith('.docx')) return 'Word';
                  return '未知';
                };

                return (
                  <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                    <div className="text-2xl">{getFileIcon(file)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getFileType(file)} • {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 水印设置 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium text-gray-900 mb-4">水印设置</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  水印类型
                </label>
                <select
                  value={watermark.settings.type}
                  onChange={(e) => updateWatermarkSettings({ type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">文字水印</option>
                  <option value="image">图片水印</option>
                  <option value="hybrid">混合水印</option>
                </select>
              </div>

{watermark.settings.type === 'text' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      水印文字
                    </label>
                    <input
                      type="text"
                      value={watermark.settings.text?.content || ''}
                      onChange={(e) => updateWatermarkSettings({
                        text: {
                          ...watermark.settings.text!,
                          content: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      水印颜色
                    </label>
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="colorType"
                            value="solid"
                            checked={typeof watermark.settings.text?.color === 'string'}
                            onChange={() => updateWatermarkSettings({
                              text: {
                                ...watermark.settings.text!,
                                color: '#FFFFFF'
                              }
                            })}
                            className="mr-2"
                          />
                          纯色
                        </label>
                        {typeof watermark.settings.text?.color === 'string' && (
                          <input
                            type="color"
                            value={watermark.settings.text?.color || '#FFFFFF'}
                            onChange={(e) => updateWatermarkSettings({
                              text: {
                                ...watermark.settings.text!,
                                color: e.target.value
                              }
                            })}
                            className="ml-6 mt-1 w-16 h-8 border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="colorType"
                            value="gradient"
                            checked={typeof watermark.settings.text?.color === 'object' && (watermark.settings.text?.color as any)?.type === 'gradient'}
                            onChange={() => updateWatermarkSettings({
                              text: {
                                ...watermark.settings.text!,
                                color: {
                                  type: 'gradient',
                                  primary: '#FF6B35',
                                  gradient: {
                                    type: 'linear',
                                    stops: [
                                      { offset: 0, color: '#FF6B35' },
                                      { offset: 1, color: '#FFD23F' }
                                    ],
                                    angle: 45
                                  }
                                }
                              }
                            })}
                            className="mr-2"
                          />
                          渐变色
                        </label>
                        {typeof watermark.settings.text?.color === 'object' && (watermark.settings.text?.color as any)?.type === 'gradient' && (
                          <div className="ml-6 mt-2 space-y-2 p-3 bg-gray-50 rounded">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">渐变类型</label>
                              <select
                                value={(watermark.settings.text?.color as any)?.gradient?.type || 'linear'}
                                onChange={(e) => {
                                  const colorConfig = watermark.settings.text?.color as any;
                                  updateWatermarkSettings({
                                    text: {
                                      ...watermark.settings.text!,
                                      color: {
                                        ...colorConfig,
                                        gradient: {
                                          ...colorConfig.gradient,
                                          type: e.target.value
                                        }
                                      }
                                    }
                                  });
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              >
                                <option value="linear">线性渐变</option>
                                <option value="radial">径向渐变</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">起始颜色</label>
                              <input
                                type="color"
                                value={(watermark.settings.text?.color as any)?.gradient?.stops?.[0]?.color || '#FF6B35'}
                                onChange={(e) => {
                                  const colorConfig = watermark.settings.text?.color as any;
                                  const stops = colorConfig.gradient?.stops || [];
                                  stops[0] = { offset: 0, color: e.target.value };
                                  updateWatermarkSettings({
                                    text: {
                                      ...watermark.settings.text!,
                                      color: {
                                        ...colorConfig,
                                        gradient: {
                                          ...colorConfig.gradient,
                                          stops
                                        }
                                      }
                                    }
                                  });
                                }}
                                className="w-full h-8 border border-gray-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">结束颜色</label>
                              <input
                                type="color"
                                value={(watermark.settings.text?.color as any)?.gradient?.stops?.[1]?.color || '#FFD23F'}
                                onChange={(e) => {
                                  const colorConfig = watermark.settings.text?.color as any;
                                  const stops = colorConfig.gradient?.stops || [];
                                  stops[1] = { offset: 1, color: e.target.value };
                                  updateWatermarkSettings({
                                    text: {
                                      ...watermark.settings.text!,
                                      color: {
                                        ...colorConfig,
                                        gradient: {
                                          ...colorConfig.gradient,
                                          stops
                                        }
                                      }
                                    }
                                  });
                                }}
                                className="w-full h-8 border border-gray-300 rounded"
                              />
                            </div>
                            {(watermark.settings.text?.color as any)?.gradient?.type === 'linear' && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  渐变角度: {(watermark.settings.text?.color as any)?.gradient?.angle || 45}°
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="360"
                                  value={(watermark.settings.text?.color as any)?.gradient?.angle || 45}
                                  onChange={(e) => {
                                    const colorConfig = watermark.settings.text?.color as any;
                                    updateWatermarkSettings({
                                      text: {
                                        ...watermark.settings.text!,
                                        color: {
                                          ...colorConfig,
                                          gradient: {
                                            ...colorConfig.gradient,
                                            angle: parseInt(e.target.value)
                                          }
                                        }
                                      }
                                    });
                                  }}
                                  className="w-full"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="colorType"
                            value="multi"
                            checked={typeof watermark.settings.text?.color === 'object' && (watermark.settings.text?.color as any)?.type === 'multi'}
                            onChange={() => updateWatermarkSettings({
                              text: {
                                ...watermark.settings.text!,
                                color: {
                                  type: 'multi',
                                  primary: '#E74C3C',
                                  multi: ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6']
                                }
                              }
                            })}
                            className="mr-2"
                          />
                          多色随机
                        </label>
                        {typeof watermark.settings.text?.color === 'object' && (watermark.settings.text?.color as any)?.type === 'multi' && (
                          <div className="ml-6 mt-2 space-y-2 p-3 bg-gray-50 rounded">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">颜色组合</label>
                              <div className="flex flex-wrap gap-2">
                                {((watermark.settings.text?.color as any)?.multi || ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6']).map((color: string, index: number) => (
                                  <div key={index} className="flex items-center">
                                    <input
                                      type="color"
                                      value={color}
                                      onChange={(e) => {
                                        const colorConfig = watermark.settings.text?.color as any;
                                        const newColors = [...(colorConfig.multi || [])];
                                        newColors[index] = e.target.value;
                                        updateWatermarkSettings({
                                          text: {
                                            ...watermark.settings.text!,
                                            color: {
                                              ...colorConfig,
                                              multi: newColors
                                            }
                                          }
                                        });
                                      }}
                                      className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                                      title={`颜色 ${index + 1}`}
                                    />
                                    {index > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const colorConfig = watermark.settings.text?.color as any;
                                          const newColors = [...(colorConfig.multi || [])];
                                          newColors.splice(index, 1);
                                          updateWatermarkSettings({
                                            text: {
                                              ...watermark.settings.text!,
                                              color: {
                                                ...colorConfig,
                                                multi: newColors
                                              }
                                            }
                                          });
                                        }}
                                        className="ml-1 text-red-500 hover:text-red-700 text-sm"
                                        title="删除此颜色"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {((watermark.settings.text?.color as any)?.multi || []).length < 8 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const colorConfig = watermark.settings.text?.color as any;
                                      const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#E67E22', '#1ABC9C', '#34495E'];
                                      const currentColors = colorConfig.multi || [];
                                      const availableColors = colors.filter(c => !currentColors.includes(c));
                                      if (availableColors.length > 0) {
                                        updateWatermarkSettings({
                                          text: {
                                            ...watermark.settings.text!,
                                            color: {
                                              ...colorConfig,
                                              multi: [...currentColors, availableColors[0]]
                                            }
                                          }
                                        });
                                      }
                                    }}
                                    className="w-8 h-8 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400"
                                    title="添加颜色"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  水印位置
                </label>
                <select
                  value={watermark.settings.position.placement}
                  onChange={(e) => updateWatermarkSettings({
                    position: {
                      ...watermark.settings.position,
                      placement: e.target.value as any
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="corner">单个角落</option>
                  <option value="center">页面中心</option>
                  <option value="pattern">均匀分布</option>
                  <option value="edge">边缘位置</option>
                </select>
                {watermark.settings.position.placement === 'corner' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      选择角落
                    </label>
                    <select
                      value={watermark.settings.position.corner || 'bottom-right'}
                      onChange={(e) => updateWatermarkSettings({
                        position: {
                          ...watermark.settings.position,
                          corner: e.target.value as any
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="top-left">左上角</option>
                      <option value="top-right">右上角</option>
                      <option value="bottom-left">左下角</option>
                      <option value="bottom-right">右下角</option>
                    </select>
                  </div>
                )}
                {watermark.settings.position.placement === 'edge' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      选择边缘
                    </label>
                    <select
                      value={watermark.settings.position.edge || 'bottom'}
                      onChange={(e) => updateWatermarkSettings({
                        position: {
                          ...watermark.settings.position,
                          edge: e.target.value as any
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="top">顶部</option>
                      <option value="right">右侧</option>
                      <option value="bottom">底部</option>
                      <option value="left">左侧</option>
                    </select>
                  </div>
                )}
{watermark.settings.position.placement === 'pattern' && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        排列模式
                      </label>
                      <select
                        value={watermark.settings.position.pattern?.type || 'default'}
                        onChange={(e) => updateWatermarkSettings({
                          position: {
                            ...watermark.settings.position,
                            pattern: {
                              ...watermark.settings.position.pattern,
                              type: e.target.value as any,
                              spacing: watermark.settings.position.pattern?.spacing || { x: 200, y: 150 }
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="default">默认网格</option>
                        <option value="tiled-3-column">三列平铺</option>
                        <option value="random">随机分布</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        水印间距（像素）
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="水平间距"
                          value={watermark.settings.position.pattern?.spacing?.x || 200}
                          onChange={(e) => updateWatermarkSettings({
                            position: {
                              ...watermark.settings.position,
                              pattern: {
                                ...watermark.settings.position.pattern,
                                spacing: {
                                  x: parseInt(e.target.value) || 200,
                                  y: watermark.settings.position.pattern?.spacing?.y || 150
                                }
                              }
                            }
                          })}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="垂直间距"
                          value={watermark.settings.position.pattern?.spacing?.y || 150}
                          onChange={(e) => updateWatermarkSettings({
                            position: {
                              ...watermark.settings.position,
                              pattern: {
                                ...watermark.settings.position.pattern,
                                spacing: {
                                  x: watermark.settings.position.pattern?.spacing?.x || 200,
                                  y: parseInt(e.target.value) || 150
                                }
                              }
                            }
                          })}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="stagger"
                        checked={watermark.settings.position.pattern?.stagger || false}
                        onChange={(e) => updateWatermarkSettings({
                          position: {
                            ...watermark.settings.position,
                            pattern: {
                              ...watermark.settings.position.pattern,
                              stagger: e.target.checked
                            }
                          }
                        })}
                        className="mr-2"
                      />
                      <label htmlFor="stagger" className="text-sm text-gray-700">
                        交错排列（减少遮挡）
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  透明度: {Math.round(watermark.settings.position.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={watermark.settings.position.opacity}
                  onChange={(e) => updateWatermarkSettings({
                    position: {
                      ...watermark.settings.position,
                      opacity: parseFloat(e.target.value)
                    }
                  })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  缩放: {Math.round(watermark.settings.position.scale * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={watermark.settings.position.scale}
                  onChange={(e) => updateWatermarkSettings({
                    position: {
                      ...watermark.settings.position,
                      scale: parseFloat(e.target.value)
                    }
                  })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  输出格式
                </label>
                <select
                  value={watermark.settings.output.format}
                  onChange={(e) => updateWatermarkSettings({
                    output: {
                      ...watermark.settings.output,
                      format: e.target.value as any
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {/* 根据选中文件类型动态显示格式选项 */}
                  {(() => {
                    const hasImages = files.selected.some(file => file.type.startsWith('image/'));
                    const hasPDFs = files.selected.some(file => 
                      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
                    );
                    const hasWord = files.selected.some(file => 
                      file.type === 'application/msword' || 
                      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                      file.name.toLowerCase().endsWith('.doc') ||
                      file.name.toLowerCase().endsWith('.docx')
                    );
                    
                    const options = [];
                    
                    // 保持原格式选项（优先推荐）
                    if (hasPDFs || hasWord) {
                      options.push(<option key="original" value="original">保持原格式</option>);
                    }
                    
                    // PDF格式选项
                    if (hasPDFs) {
                      options.push(<option key="pdf" value="pdf">PDF</option>);
                    }
                    
                    // Word格式选项 - 支持原格式和PDF转换
                    if (hasWord) {
                      options.push(<option key="docx" value="docx">Word (DOCX)</option>);
                      options.push(<option key="word-to-pdf" value="word-to-pdf">Word转PDF</option>);
                    }
                    
                    // 图片格式选项
                    if (hasImages || files.selected.length === 0) {
                      options.push(<option key="png" value="png">PNG</option>);
                      options.push(<option key="jpeg" value="jpeg">JPEG</option>);
                      options.push(<option key="webp" value="webp">WebP</option>);
                    }
                    
                    return options;
                  })()}
                </select>
                {files.selected.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const hasDocuments = files.selected.some(file => 
                        file.type === 'application/pdf' || 
                        file.type === 'application/msword' ||
                        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                        file.name.toLowerCase().endsWith('.pdf') ||
                        file.name.toLowerCase().endsWith('.doc') ||
                        file.name.toLowerCase().endsWith('.docx')
                      );
                      return hasDocuments ? 
                        '推荐选择"保持原格式"以维持文档的完整性和可编辑性' : 
                        '图片文件支持多种输出格式，可根据需要选择';
                    })()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {ui.progress && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {ui.progress.message}
            </span>
            <span className="text-sm text-gray-500">
              {ui.progress.current} / {ui.progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(ui.progress.current / ui.progress.total) * 100}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderPreviewView = () => (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          处理结果
        </h2>
        <div className="space-x-4">
          <Button variant="outline" onClick={handleClearFiles}>
            处理新文件
          </Button>
          <Button variant="primary" onClick={handleDownloadAll}>
            下载全部
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-8">
        {Array.from(files.results.entries()).map(([fileId, result]) => {
          const getFileIcon = (file: File) => {
            if (file.type.startsWith('image/')) return '🖼️';
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return '📄';
            if (file.type === 'application/msword' || 
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                file.name.toLowerCase().endsWith('.doc') ||
                file.name.toLowerCase().endsWith('.docx')) return '📝';
            return '📁';
          };

          const getFileType = (file: File) => {
            if (file.type.startsWith('image/')) return '图片';
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF';
            if (file.type === 'application/msword' || 
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                file.name.toLowerCase().endsWith('.doc') ||
                file.name.toLowerCase().endsWith('.docx')) return 'Word';
            return '未知';
          };

          const isDocument = !result.originalFile.type.startsWith('image/');

          return (
            <div key={fileId} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center min-h-[400px]">
                {result.success && result.processedImage.dataUrl ? (
                  isDocument ? (
                    <DocumentPreview
                      file={result.originalFile}
                      dataUrl={result.processedImage.dataUrl}
                      format={result.processedImage.format}
                      className="w-full h-full"
                    />
                  ) : (
                    <img
                      src={result.processedImage.dataUrl}
                      alt={result.originalFile.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  )
                ) : (
                  <div className="text-center">
                    <div className="text-gray-400 text-4xl mb-2">❌</div>
                    <div className="text-sm text-gray-500">处理失败</div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 truncate">
                  {result.originalFile.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {result.success ? (
                    <>
                      {getFileType(result.originalFile)} • 处理成功
                      {result.metadata?.processingTime && (
                        <span> • {Math.round(result.metadata.processingTime)}ms</span>
                      )}
                    </>
                  ) : (
                    '处理失败'
                  )}
                </p>
                {result.success && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">
                      {(result.processedImage.size / 1024).toFixed(1)} KB
                      {result.metadata?.compressionRatio && result.metadata.compressionRatio < 1 && (
                        <span className="text-green-600 ml-1">
                          压缩 {Math.round((1 - result.metadata.compressionRatio) * 100)}%
                        </span>
                      )}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownloadSingle(result)}
                    >
                      下载 {isDocument ? getFileType(result.originalFile) : '图片'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (ui.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-red-600 text-4xl mb-4 text-center">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
            {ui.error.userMessage}
          </h2>
          <p className="text-gray-600 text-center mb-4">
            {ui.error.message}
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {ui.activeView === 'upload' && renderUploadView()}
      {ui.activeView === 'editor' && renderEditorView()}
      {ui.activeView === 'preview' && renderPreviewView()}
    </div>
  );
};

export default App;