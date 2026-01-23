/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';

export default function Play2Page() {
  const [mounted, setMounted] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    if (!mounted) return;
    
    const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
    const PLAYER_BASE_URL = 'https://jx.xmflv.cc/?url=';
    const originalUrl = `${PLAYER_BASE_URL}${videoUrl}`;
    
    // 使用API代理
    const localProxyUrl = `/api/proxy-video?proxyurl=${encodeURIComponent(originalUrl)}`;
  
    // 选择其中一个使用
    setIframeSrc(localProxyUrl); // 或使用 externalProxyUrl
    
  }, [mounted]);
  
  if (!mounted) {
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
        <h1 className="text-xl font-bold">第三方播放器演示</h1>
        <div className="mt-2 text-sm text-gray-600">
          通过代理服务加载，解决跨域限制
        </div>
      </div>
      <div className="flex-1">
        {iframeSrc ? (
          <iframe
            src={iframeSrc}
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500 mb-2"></div>
              <p className="text-gray-600">正在准备播放器...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
