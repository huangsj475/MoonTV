/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';

export default function Play2Page() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
  
  // 关键：iframe的src要带参数！
  const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`;
  
  const handleIframeLoad = () => {
    console.log('iframe加载完成');
    setLoading(false);
  };
  
  const handleIframeError = () => {
    console.log('iframe加载错误');
    setLoading(false);
  };
  
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500 mb-2"></div>
          <p className="text-gray-600">初始化中...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-gray-100">
        <h1 className="text-xl font-bold">第三方播放器演示（代理版）</h1>
        <p className="text-sm text-gray-600 mt-1">已启用广告过滤</p>
      </div>
      
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
              <p className="text-white text-lg">正在加载播放器...</p>
              <p className="text-white/70 text-sm mt-2">广告过滤中</p>
            </div>
          </div>
        )}
        
        <iframe
          src={proxyUrl}
          title="视频播放器"
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
      
      <div className="p-3 bg-gray-100 border-t flex justify-between items-center">
        <div className="text-sm text-gray-600">
          状态: {loading ? '加载中...' : '已加载'}
        </div>
        <div className="space-x-2">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            刷新
          </button>
          <a
            href="https://jx.xmflv.cc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 inline-block"
          >
            原网站
          </a>
        </div>
      </div>
    </div>
  );
}
