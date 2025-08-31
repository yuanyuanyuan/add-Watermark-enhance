/**
 * 应用程序入口
 * 基于架构文档的启动配置
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 检查浏览器兼容性
const checkBrowserSupport = () => {
  const features = {
    'Canvas API': 'HTMLCanvasElement' in window,
    'Web Workers': 'Worker' in window,
    'Web Crypto API': 'crypto' in window && 'subtle' in window.crypto,
    'Offscreen Canvas': 'OffscreenCanvas' in window,
    'File API': 'File' in window && 'FileReader' in window
  };

  const unsupported = Object.entries(features)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature);

  if (unsupported.length > 0) {
    console.warn('Unsupported browser features:', unsupported);
    
    // 显示兼容性警告
    const warning = document.createElement('div');
    warning.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; right: 0; 
        background: #f59e0b; color: white; padding: 10px; 
        text-align: center; z-index: 10000;
      ">
        ⚠️ 您的浏览器不支持某些功能: ${unsupported.join(', ')}。建议使用最新版本的 Chrome、Firefox 或 Safari。
        <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: 1px solid white; color: white; padding: 2px 8px; cursor: pointer;">
          关闭
        </button>
      </div>
    `;
    document.body.appendChild(warning);
  }

  return unsupported.length === 0;
};

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// 检查浏览器支持
const isSupported = checkBrowserSupport();

// 渲染应用
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSupported ? (
      <App />
    ) : (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>
          🚫 浏览器不兼容
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '30px', maxWidth: '500px' }}>
          水印增强产品需要现代浏览器支持。请使用最新版本的：
        </p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div>🌐 Chrome 90+</div>
          <div>🦊 Firefox 88+</div>
          <div>🍎 Safari 14+</div>
          <div>📘 Edge 90+</div>
        </div>
      </div>
    )}
  </React.StrictMode>
);