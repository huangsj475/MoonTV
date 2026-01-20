/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';
import PageLayout from '@/components/PageLayout';

function SimpleThirdPartyPlayPageClient() {
  // 固定的视频URL
  const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
  
  // 第三方播放器基础URL
  const PLAYER_BASE_URL = 'https://jx.xmflv.cc/?url=';
  
  // iframe的完整URL
  const [iframeSrc, setIframeSrc] = useState('');
  
  // 加载状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    console.log('加载视频:', videoUrl);
    
    // 编码URL并构建完整iframe地址
    const encodedUrl = encodeURIComponent(videoUrl);
    const fullUrl = `${PLAYER_BASE_URL}${encodedUrl}`;
    setIframeSrc(fullUrl);
    
    console.log('iframe地址:', fullUrl);
  }, []);

  // iframe加载完成
  const handleIframeLoad = () => {
    console.log('第三方播放器加载完成');
    setLoading(false);
  };

  // iframe加载错误
  const handleIframeError = () => {
    console.error('第三方播放器加载失败');
    setLoading(false);
    setError('播放器加载失败，请检查网络或URL');
  };

  if (loading && !iframeSrc) {
    return (
      <PageLayout activePath='/play2'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>🎬</div>
                <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
              </div>
            </div>
            <div className='space-y-2'>
              <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
                正在初始化播放器...
              </p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play2'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>😵</div>
                <div className='absolute -inset-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-20 animate-pulse'></div>
              </div>
            </div>
            <div className='space-y-4 mb-8'>
              <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
                播放器加载失败
              </h2>
              <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
                <p className='text-red-600 dark:text-red-400 font-medium'>
                  {error}
                </p>
              </div>
            </div>
            <div className='space-y-3'>
              <button
                onClick={() => window.location.reload()}
                className='w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl'
              >
                🔄 重新加载
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

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
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              {iframeSrc && (
                <a 
                  href={iframeSrc} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 underline"
                >
                  在新窗口打开
                </a>
              )}
            </div>
          </div>
        </div>
        
        {/* iframe播放器区域 - 全屏 */}
        <div className='flex-1 relative bg-black'>
          {iframeSrc && (
            <iframe
              key="player-iframe"
              src={iframeSrc}
              title="第三方视频播放器"
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          )}
          
          {/* 加载遮罩 */}
          {loading && (
            <div className='absolute inset-0 bg-black/90 flex items-center justify-center'>
              <div className='text-center'>
                <div className='inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4'></div>
                <p className='text-white text-lg'>播放器加载中...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* 底部控制栏 */}
        <div className='flex-none p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800'>
          <div className='flex items-center justify-between'>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              <p>演示：使用 xmflv.cc 解析播放视频</p>
              <p className='mt-1 text-xs'>
                播放器地址: <span className='text-green-500'>https://jx.xmflv.cc</span>
              </p>
            </div>
            <div className='space-x-2'>
              <button
                onClick={() => {
                  if (iframeSrc) {
                    window.open(iframeSrc, '_blank');
                  }
                }}
                className='px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors'
              >
                全屏播放
              </button>
              <button
                onClick={() => {
                  const encodedUrl = encodeURIComponent(videoUrl);
                  const newSrc = `${PLAYER_BASE_URL}${encodedUrl}`;
                  setIframeSrc(newSrc);
                  setLoading(true);
                }}
                className='px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors'
              >
                刷新播放器
              </button>
            </div>
          </div>
        </div>
        
        {/* 调试信息 */}
        {process.env.NODE_ENV === 'development' && (
          <div className='fixed bottom-4 left-4 bg-black/70 text-white p-3 rounded-lg text-xs max-w-md z-50'>
            <p className='font-mono break-all opacity-80'>
              {iframeSrc}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(iframeSrc);
                alert('URL已复制到剪贴板');
              }}
              className='mt-2 px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs'
            >
              复制URL
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function SimpleThirdPartyPlayPage() {
  return <SimpleThirdPartyPlayPageClient />;
}
