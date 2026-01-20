/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';

export default function Play2Page() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
  const PLAYER_BASE_URL = 'https://jx.xmflv.cc/?url=';
  const encodedUrl = encodeURIComponent(videoUrl);
  const iframeSrc = `${PLAYER_BASE_URL}${encodedUrl}`;
  
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
      </div>
      <div className="flex-1">
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
