/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';
import PageLayout from '@/components/PageLayout';

export default function SimpleThirdPartyPlayPage() {
  // 固定的视频URL
  const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
  
  // 第三方播放器基础URL
  const PLAYER_BASE_URL = 'https://jx.xmflv.cc/?url=';
  
  // iframe的完整URL
  const [iframeSrc, setIframeSrc] = useState('');
  
  // 加载状态
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // 只在客户端运行
    if (typeof window === 'undefined') return;
    
    console.log('加载视频:', videoUrl);
    
    // 编码URL并构建完整iframe地址
    const encodedUrl = encodeURIComponent(videoUrl);
    const fullUrl = `${PLAYER_BASE_URL}${encodedUrl}`;
    setIframeSrc(fullUrl);
    
    console.log('iframe地址:', fullUrl);
    setLoading(false);
  }, []);

  return (
    <PageLayout activePath='/play2'>
      <div className='flex flex-col h-screen p-0'>
        {/* 顶部信息栏 */}
        <div className='flex-none p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                第三方播放器演示
              </h1>
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                正在播放示例视频（爱奇艺）
              </p>
            </div>
          </div>
        </div>
        
        {/* iframe播放器区域 */}
        <div className='flex-1 relative bg-black'>
          {iframeSrc ? (
            <iframe
              key="player-iframe"
              src={iframeSrc}
              title="第三方视频播放器"
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div className='w-full h-full flex items-center justify-center'>
              <div className='text-center'>
                <div className='inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4'></div>
                <p className='text-white text-lg'>初始化播放器...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* 底部信息 */}
        <div className='flex-none p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800'>
          <div className='text-sm text-gray-500 dark:text-gray-400'>
            <p>演示：使用第三方解析播放视频</p>
            <p className='mt-1 text-xs'>
              当前视频: <span className='text-green-500'>{videoUrl}</span>
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
