/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';

export default function Play2Page() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('direct'); // direct, proxy, jsproxy
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
  
  // 三种模式
  const urls = {
    direct: `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`,
    proxy: `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`,
    jsproxy: `/api/proxy-video?url=${encodeURIComponent(videoUrl)}&mode=js`,
  };
  
  const handleIframeLoad = () => {
    console.log('iframe加载成功，模式:', mode);
    setLoading(false);
  };
  
  const handleIframeError = () => {
    console.log('iframe加载失败，模式:', mode);
    setLoading(false);
    
    // 自动切换到下一个模式
    if (mode === 'direct') {
      setMode('proxy');
      setLoading(true);
    } else if (mode === 'proxy') {
      setMode('jsproxy');
      setLoading(true);
    }
  };
  
  const switchMode = (newMode) => {
    setMode(newMode);
    setLoading(true);
  };
  
  if (!mounted) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* 模式选择器 */}
      <div className="p-3 bg-gray-800 text-white border-b border-gray-700 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">视频播放器测试</h1>
          <p className="text-xs text-gray-400">当前模式: 
            <span className={`ml-2 px-2 py-1 rounded text-xs ${mode === 'direct' ? 'bg-red-500' : mode === 'proxy' ? 'bg-blue-500' : 'bg-green-500'}`}>
              {mode === 'direct' ? '直接模式' : mode === 'proxy' ? '代理模式' : 'JS代理模式'}
            </span>
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => switchMode('direct')}
            className={`px-3 py-1 rounded text-sm ${mode === 'direct' ? 'bg-red-600' : 'bg-gray-700'}`}
          >
            直接
          </button>
          <button
            onClick={() => switchMode('proxy')}
            className={`px-3 py-1 rounded text-sm ${mode === 'proxy' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            代理
          </button>
          <button
            onClick={() => switchMode('jsproxy')}
            className={`px-3 py-1 rounded text-sm ${mode === 'jsproxy' ? 'bg-green-600' : 'bg-gray-700'}`}
          >
            JS代理
          </button>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-white text-lg">加载中 ({mode})...</p>
              <p className="text-gray-400 text-sm mt-2">模式说明: {getModeDescription(mode)}</p>
            </div>
          </div>
        )}
        
        <iframe
          key={`${mode}-${Date.now()}`}
          src={urls[mode]}
          title="视频播放器"
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      
      {/* 状态信息 */}
      <div className="p-2 bg-gray-800 text-xs text-gray-400 border-t border-gray-700">
        <div className="flex justify-between">
          <div>
            视频: {videoUrl.substring(0, 40)}...
          </div>
          <div>
            {loading ? '🔄 加载中' : '✅ 已加载'}
          </div>
        </div>
      </div>
    </div>
  );
}

function getModeDescription(mode) {
  switch(mode) {
    case 'direct': return '直接iframe第三方网站';
    case 'proxy': return '通过HTML代理iframe';
    case 'jsproxy': return '代理并修改JS绕过检测';
    default: return '';
  }
}
