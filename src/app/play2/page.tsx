'use client';

import { useEffect, useState } from 'react';

export default function Play2Page() {
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
  
  useEffect(() => {
    async function loadProxyPage() {
      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(
          `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        setHtmlContent(html);
        
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '加载失败');
        console.error('加载失败:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadProxyPage();
  }, [videoUrl]);
  
  // 🎯 修复：添加参数类型
  const fixRelativePaths = (container: HTMLElement) => {
    // 修复 <base> 标签
    let baseElement = container.querySelector('base');
    if (!baseElement) {
      baseElement = document.createElement('base');
      baseElement.setAttribute('href', 'https://jx.xmflv.cc/');
      container.prepend(baseElement);
    }
    
    // 修复相对链接
    const elements = container.querySelectorAll('[src], [href]');
    elements.forEach(el => {
      const src = el.getAttribute('src');
      const href = el.getAttribute('href');
      
      if (src && src.startsWith('//')) {
        el.setAttribute('src', 'https:' + src);
      } else if (src && src.startsWith('/')) {
        el.setAttribute('src', 'https://jx.xmflv.cc' + src);
      }
      
      if (href && href.startsWith('//')) {
        el.setAttribute('href', 'https:' + href);
      } else if (href && href.startsWith('/')) {
        el.setAttribute('href', 'https://jx.xmflv.cc' + href);
      }
    });
  };
  
  // 🎯 当HTML内容加载后，手动插入到页面
  useEffect(() => {
    if (!htmlContent || loading) return;
    
    const container = document.getElementById('player-container');
    if (!container) return;
    
    // 创建一个临时div来解析HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // 清理容器
    container.innerHTML = '';
    
    // 将解析后的节点移动到容器
    while (tempDiv.firstChild) {
      container.appendChild(tempDiv.firstChild);
    }
    
    // 🎯 修复相对路径
    fixRelativePaths(container);
    
    console.log('页面已直接渲染');
    
  }, [htmlContent, loading]);
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#000',
        color: '#fff'
      }}>
        加载去广告播放器...
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ 
        padding: '20px',
        background: '#000',
        color: '#fff',
        height: '100vh'
      }}>
        <h2>加载失败</h2>
        <p>{error}</p>
        <a 
          href={`https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`}
          target="_blank"
          rel="noopener"
          style={{ color: '#4dabf7' }}
        >
          直接访问播放器
        </a>
      </div>
    );
  }
  
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 🎯 关键：这是我们的播放器容器 */}
      <div 
        id="player-container" 
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* 状态提示 */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: '#0f0',
        padding: '5px 10px',
        fontSize: '12px',
        borderRadius: '3px',
        zIndex: 9999
      }}>
        直接渲染模式 ✓
      </div>
    </div>
  );
}
