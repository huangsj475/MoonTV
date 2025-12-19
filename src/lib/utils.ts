/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import Hls from 'hls.js';

function getDoubanImageProxyConfig(): {
  proxyType:
    | 'direct'
    | 'server'
    | 'img3'
    | 'cmliussss-cdn-tencent'
    | 'cmliussss-cdn-ali'
    | 'custom';
  proxyUrl: string;
} {
  const doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'direct';
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}
/**
 * 获取图片代理 URL 设置
 */
/*export function getImageProxyUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 本地未开启图片代理，则不使用代理
  const enableImageProxy = localStorage.getItem('enableImageProxy');
  if (enableImageProxy !== null) {
    if (!JSON.parse(enableImageProxy) as boolean) {
      return null;
    }
  }

  const localImageProxy = localStorage.getItem('imageProxyUrl');
  if (localImageProxy != null) {
    return localImageProxy.trim() ? localImageProxy.trim() : null;
  }

  // 如果未设置，则使用全局对象
  const serverImageProxy = (window as any).RUNTIME_CONFIG?.IMAGE_PROXY;
  return serverImageProxy && serverImageProxy.trim()
    ? serverImageProxy.trim()
    : null;
}*/

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  
  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }
  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    case 'direct':
    default:
      return originalUrl;
  }
}

/**
 * 获取豆瓣代理 URL 设置
 */
/*export function getDoubanProxyUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 本地未开启豆瓣代理，则不使用代理
  const enableDoubanProxy = localStorage.getItem('enableDoubanProxy');
  if (enableDoubanProxy !== null) {
    if (!JSON.parse(enableDoubanProxy) as boolean) {
      return null;
    }
  }

  const localDoubanProxy = localStorage.getItem('doubanProxyUrl');
  if (localDoubanProxy != null) {
    return localDoubanProxy.trim() ? localDoubanProxy.trim() : null;
  }

  // 如果未设置，则使用全局对象
  const serverDoubanProxy = (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY;
  return serverDoubanProxy && serverDoubanProxy.trim()
    ? serverDoubanProxy.trim()
    : null;
}*/

/**
 * 处理豆瓣 URL，如果设置了豆瓣代理则使用代理
 */
/*export function processDoubanUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  const proxyUrl = getDoubanProxyUrl();
  if (!proxyUrl) return originalUrl;

  return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
}*/

export function cleanHtmlTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .replace(/&nbsp;/g, ' ') // 将 &nbsp; 替换为空格
    .trim(); // 去掉首尾空格
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}> 视频质量等级和网络信息
 */

// 存储每个分片的开始加载时间
const fragmentStartTimes = new Map<string, number>();

/**
 * 改进版测速函数 - 保留旧代码的可靠性，增加新代码的智能性
 */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  try {
    console.log(`开始测速: ${m3u8Url}`);
    
    // 方案1：先尝试从m3u8内容直接解析分辨率（快速、准确）
    const quickResolution = await tryQuickResolutionDetection(m3u8Url);
    if (quickResolution.success) {
      console.log(`快速检测到分辨率: ${quickResolution.quality}`);
      // 仍然需要测试速度和ping
      const speedAndPing = await testSpeedAndPingOnly(m3u8Url);
      return {
        quality: quickResolution.quality,
        loadSpeed: speedAndPing.loadSpeed,
        pingTime: speedAndPing.pingTime
      };
    }
    
    // 方案2：使用HLS.js加载并检测（旧方法，更可靠）
    console.log('快速检测失败，使用HLS.js方法');
    return await testWithHlsJs(m3u8Url);
    
  } catch (error) {
    console.error('测速失败:', error);
    // 返回保守的默认值
    return {
      quality: '未知',
      loadSpeed: '测速失败',
      pingTime: 999
    };
  }
}

/**
 * 方案1：快速分辨率检测（从m3u8内容解析）
 */
async function tryQuickResolutionDetection(
  m3u8Url: string
): Promise<{ success: boolean; quality: string }> {
  try {
    const response = await fetch(m3u8Url, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3秒超时
    });
    
    if (!response.ok) {
      return { success: false, quality: '未知' };
    }
    
    const content = await response.text();
    
    // 方法1：从RESOLUTION属性解析
    const resolutionMatch = content.match(/RESOLUTION=(\d+x\d+)/);
    if (resolutionMatch) {
      const res = parseResolution(resolutionMatch[1]);
      if (res.width > 0) {
        return {
          success: true,
          quality: getQualityFromResolution(res.width, res.height)
        };
      }
    }
    
    // 方法2：从EXT-X-STREAM-INF解析
    const streamInfMatch = content.match(/#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)/);
    if (streamInfMatch) {
      const res = parseResolution(streamInfMatch[1]);
      if (res.width > 0) {
        return {
          success: true,
          quality: getQualityFromResolution(res.width, res.height)
        };
      }
    }
    
    // 方法3：检查是否是主播放列表，尝试第一个变体
    if (content.includes('#EXT-X-STREAM-INF') && !content.includes('#EXTINF')) {
      // 尝试获取第一个变体的URL
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('#EXT-X-STREAM-INF') && i + 1 < lines.length) {
          const variantUrl = lines[i + 1].trim();
          if (variantUrl && !variantUrl.startsWith('#')) {
            const fullUrl = new URL(variantUrl, m3u8Url).href;
            // 递归检测变体
            const variantResult = await tryQuickResolutionDetection(fullUrl);
            if (variantResult.success) {
              return variantResult;
            }
            break; // 只尝试第一个变体
          }
        }
      }
    }
    
    return { success: false, quality: '未知' };
  } catch (error) {
    console.warn('快速分辨率检测失败:', error);
    return { success: false, quality: '未知' };
  }
}

/**
 * 仅测试速度和ping（不检测分辨率）
 */
async function testSpeedAndPingOnly(
  m3u8Url: string
): Promise<{ loadSpeed: string; pingTime: number }> {
  const startTime = performance.now();
  
  try {
    // Ping测试
    const pingStart = performance.now();
    let pingTime = 0;
    
    await fetch(m3u8Url, { 
      method: 'HEAD',
      mode: 'no-cors',
      signal: AbortSignal.timeout(2000)
    }).then(() => {
      pingTime = performance.now() - pingStart;
    }).catch(() => {
      pingTime = performance.now() - pingStart;
    });
    
    // 速度测试（简单下载文件）
    const response = await fetch(m3u8Url, {
      signal: AbortSignal.timeout(5000)
    });
    const content = await response.text();
    const endTime = performance.now();
    
    const loadTime = endTime - startTime;
    const size = new TextEncoder().encode(content).length;
    
    let loadSpeed = '未知';
    if (loadTime > 0 && size > 0) {
      const speedKBps = (size / 1024) / (loadTime / 1000);
      if (speedKBps >= 1024) {
        loadSpeed = `${(speedKBps / 1024).toFixed(1)} MB/s`;
      } else {
        loadSpeed = `${speedKBps.toFixed(1)} KB/s`;
      }
    }
    
    return {
      loadSpeed,
      pingTime: Math.round(pingTime)
    };
  } catch (error) {
    console.warn('速度和ping测试失败:', error);
    return {
      loadSpeed: '测速失败',
      pingTime: Math.round(performance.now() - startTime)
    };
  }
}

/**
 * 方案2：使用HLS.js检测（旧方法，保持兼容性）
 */
async function testWithHlsJs(
  m3u8Url: string
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  return new Promise((resolve, reject) => {
    fragmentStartTimes.clear();
    
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.style.display = 'none';
    document.body.appendChild(video);
    
    // Ping测试
    const pingStart = performance.now();
    let pingTime = 0;
    
    fetch(m3u8Url, { 
      method: 'HEAD',
      mode: 'no-cors' 
    }).then(() => {
      pingTime = performance.now() - pingStart;
    }).catch(() => {
      pingTime = performance.now() - pingStart;
    });
    
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 10,
      maxBufferLength: 30,
      debug: false
    });
    
    // 超时处理
    const timeout = setTimeout(() => {
      console.warn('HLS.js测速超时');
      cleanup();
      reject(new Error('测速超时'));
    }, 8000);
    
    // 状态变量
    let hasVideoSegmentLoaded = false;
    let totalVideoSize = 0;
    let totalVideoTime = 0;
    let segmentCount = 0;
    let videoWidth = 0;
    let videoHeight = 0;
    let speedCalculated = false;
    
    // 监听分片加载开始
    hls.on(Hls.Events.FRAG_LOADING, (event: any, data: any) => {
      if (data.frag && data.frag.type === 'main') {
        const fragId = `${data.frag.sn}-${data.frag.level}`;
        fragmentStartTimes.set(fragId, performance.now());
        data.frag._startTime = performance.now();
      }
    });
    
    // 监听分片加载完成
    hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
      if (data.frag?.type === 'main' && data.payload) {
        const size = data.payload.byteLength || 0;
        let loadTime = 0;
        const fragId = `${data.frag.sn}-${data.frag.level}`;
        
        if (fragmentStartTimes.has(fragId)) {
          const startTime = fragmentStartTimes.get(fragId)!;
          loadTime = performance.now() - startTime;
          fragmentStartTimes.delete(fragId);
        } else if (data.frag._startTime) {
          loadTime = performance.now() - data.frag._startTime;
        } else {
          loadTime = 100;
        }
        
        // 确保加载时间合理
        if (loadTime < 10) loadTime = 50;
        if (loadTime > 10000) loadTime = 10000;
        
        // 只统计有效的视频分片
        if (size > 1024 && loadTime > 0) {
          totalVideoSize += size;
          totalVideoTime += loadTime;
          segmentCount++;
          hasVideoSegmentLoaded = true;
          
          // 收集2个分片后计算速度
          if (segmentCount >= 2 && !speedCalculated) {
            speedCalculated = true;
            
            // 计算平均速度
            const avgSpeedKBps = (totalVideoSize / 1024) / (totalVideoTime / 1000);
            let loadSpeed = '未知';
            
            if (avgSpeedKBps >= 1024) {
              loadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              loadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            
            // 获取分辨率 - 优先从视频元素获取
            let quality = '检测失败'; // 默认值
            if (videoWidth > 0) {
              quality = getQualityFromResolution(videoWidth, videoHeight);
            } else {
              // 再次尝试获取
              videoWidth = video.videoWidth;
              videoHeight = video.videoHeight;
              if (videoWidth > 0) {
                quality = getQualityFromResolution(videoWidth, videoHeight);
              }
            }
            
            console.log(`HLS.js测速完成: ${quality}, ${loadSpeed}, ${Math.round(pingTime)}ms`);
            
            clearTimeout(timeout);
            cleanup();
            
            resolve({
              quality,
              loadSpeed,
              pingTime: Math.round(pingTime)
            });
          }
        }
      }
    });
    
    // 监听视频尺寸变化
    video.onresize = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
      }
    };
    
    // 监听元数据加载
    video.onloadedmetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
      }
    };
    
    // 监听HLS错误
    hls.on(Hls.Events.ERROR, (event: any, data: any) => {
      if (data.fatal) {
        console.warn('HLS致命错误:', data.type);
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`HLS错误: ${data.type}`));
      }
    });
    
    // 开始加载
    try {
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      
      // 尝试播放以触发加载
      setTimeout(() => {
        if (video.paused) {
          video.play().catch(() => {});
        }
      }, 500);
      
      // 备用超时：如果5秒后没有分片
      setTimeout(() => {
        if (!hasVideoSegmentLoaded && !speedCalculated) {
          console.log('HLS.js备用方案');
          clearTimeout(timeout);
          cleanup();
          
          // 尝试快速检测
          tryQuickResolutionDetection(m3u8Url)
            .then(resolutionResult => {
              testSpeedAndPingOnly(m3u8Url)
                .then(speedResult => {
                  resolve({
                    quality: resolutionResult.quality,
                    loadSpeed: speedResult.loadSpeed,
                    pingTime: speedResult.pingTime
                  });
                })
                .catch(() => {
                  resolve({
                    quality: resolutionResult.quality,
                    loadSpeed: '测速失败',
                    pingTime: 999
                  });
                });
            })
            .catch(() => {
              resolve({
                quality: '未知',
                loadSpeed: '测速失败',
                pingTime: 999
              });
            });
        }
      }, 5000);
      
    } catch (err) {
      clearTimeout(timeout);
      cleanup();
      reject(err);
    }
    
    function cleanup() {
      fragmentStartTimes.clear();
      if (hls) {
        try {
          hls.destroy();
        } catch (e) {}
      }
      if (video && video.parentNode) {
        video.parentNode.removeChild(video);
      }
    }
  });
}

/**
 * 解析分辨率字符串
 */
function parseResolution(resStr: string): { width: number; height: number } {
  const match = resStr.match(/(\d+)x(\d+)/);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10)
    };
  }
  return { width: 0, height: 0 };
}

/**
 * 根据分辨率获取质量等级（与旧代码保持一致）
 */
function getQualityFromResolution(width: number, height: number): string {
  if (width >= 3840 || height >= 2160) return '4K';
  if (width >= 2560 || height >= 1440) return '2K';
  if (width >= 1920 || height >= 1080) return '1080p';
  if (width >= 1280 || height >= 720) return '720p';
  if (width >= 854 || height >= 480) return '480p';
  if (width > 0 || height > 0) return 'SD';
  return '未知'; // 保持一致
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}
