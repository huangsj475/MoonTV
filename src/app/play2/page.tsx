/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';

export default function Play2Page() {
  const [mounted, setMounted] = useState(false);
  const [iframeSrc, setIframeSrc] = useState('');
  
  useEffect(() => {
    setMounted(true);
    
    const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
    const encodedUrl = encodeURIComponent(videoUrl);
    // 使用我们的代理API
    const proxyUrl = `/api/proxy-video?url=${encodedUrl}`;
    setIframeSrc(proxyUrl);
  }, []);
  
  if (!mounted || !iframeSrc) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500 mb-2"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-gray-100">
        <h1 className="text-xl font-bold">第三方播放器演示（无广告）</h1>
      </div>
      <div className="flex-1">
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
