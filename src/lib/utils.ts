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
 * 完整的测速函数
 */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
  isMasterPlaylist?: boolean;
}> {
  try {
    // 步骤1: 检测是否是主播放列表
    const playlistInfo = await analyzePlaylist(m3u8Url);
    
    if (playlistInfo.isMasterPlaylist && playlistInfo.bestVariantUrl) {
      // 对于主播放列表，测试最佳变体
      console.log(`检测到主播放列表，测试最佳变体: ${playlistInfo.bestVariantUrl}`);
      return await testVariantPlaylist(
        playlistInfo.bestVariantUrl,
        playlistInfo.bestVariantResolution
      );
    } else {
      // 对于普通播放列表或无法获取变体的情况
      console.log(`测试直接播放列表: ${m3u8Url}`);
      return await testDirectPlaylist(m3u8Url, playlistInfo.resolution);
    }
  } catch (error) {
    console.error('测速失败:', error);
    // 返回默认值
    return {
      quality: '未知',
      loadSpeed: '测量失败',
      pingTime: 999,
      isMasterPlaylist: false
    };
  }
}

/**
 * 分析播放列表类型和内容
 */
async function analyzePlaylist(
  m3u8Url: string
): Promise<{
  isMasterPlaylist: boolean;
  bestVariantUrl?: string;
  bestVariantResolution?: string;
  resolution?: string;
}> {
  try {
    const response = await fetch(m3u8Url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    
    // 检查是否是主播放列表
    const hasStreamInf = content.includes('#EXT-X-STREAM-INF');
    const hasExtInf = content.includes('#EXTINF');
    
    const isMasterPlaylist = hasStreamInf && !hasExtInf;
    
    if (isMasterPlaylist) {
      // 解析主播放列表，获取最佳变体
      const variants = parseMasterPlaylist(content, m3u8Url);
      
      if (variants.length > 0) {
        // 选择最佳变体（最高分辨率）
        const bestVariant = selectBestVariant(variants);
        return {
          isMasterPlaylist: true,
          bestVariantUrl: bestVariant.url,
          bestVariantResolution: bestVariant.resolution,
          resolution: bestVariant.resolution
        };
      }
    } else {
      // 尝试从普通播放列表中提取分辨率信息
      const resolution = extractResolutionFromPlaylist(content);
      return {
        isMasterPlaylist: false,
        resolution
      };
    }
    
    return { isMasterPlaylist };
  } catch (error) {
    console.warn('分析播放列表失败:', error);
    return { isMasterPlaylist: false };
  }
}

/**
 * 解析主播放列表
 */
function parseMasterPlaylist(
  content: string,
  baseUrl: string
): Array<{
  url: string;
  bandwidth?: number;
  resolution?: string;
  codecs?: string;
}> {
  const lines = content.split('\n');
  const variants: Array<{
    url: string;
    bandwidth?: number;
    resolution?: string;
    codecs?: string;
  }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const variant: any = {};
      
      // 解析属性
      const attrStr = line.substring('#EXT-X-STREAM-INF:'.length);
      
      // 解析带宽
      const bandwidthMatch = attrStr.match(/BANDWIDTH=(\d+)/);
      if (bandwidthMatch) {
        variant.bandwidth = parseInt(bandwidthMatch[1], 10);
      }
      
      // 解析分辨率
      const resolutionMatch = attrStr.match(/RESOLUTION=(\d+x\d+)/);
      if (resolutionMatch) {
        variant.resolution = resolutionMatch[1];
      }
      
      // 解析编解码器
      const codecsMatch = attrStr.match(/CODECS="([^"]+)"/);
      if (codecsMatch) {
        variant.codecs = codecsMatch[1];
      }
      
      // 下一行应该是URL
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          variant.url = new URL(nextLine, baseUrl).href;
          variants.push(variant);
          i++; // 跳过URL行
        }
      }
    }
  }
  
  return variants;
}

/**
 * 选择最佳变体
 */
function selectBestVariant(variants: any[]): any {
  if (variants.length === 0) {
    throw new Error('没有可用的变体');
  }
  
  // 优先按分辨率选择
  const variantsWithResolution = variants.filter(v => v.resolution);
  if (variantsWithResolution.length > 0) {
    // 按分辨率排序（从高到低）
    return variantsWithResolution.sort((a, b) => {
      const resA = parseResolution(a.resolution);
      const resB = parseResolution(b.resolution);
      const pixelsA = resA.width * resA.height;
      const pixelsB = resB.width * resB.height;
      return pixelsB - pixelsA; // 降序
    })[0];
  }
  
  // 其次按带宽选择
  return variants.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
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
 * 从播放列表内容提取分辨率
 */
function extractResolutionFromPlaylist(content: string): string | undefined {
  const resolutionMatch = content.match(/RESOLUTION=(\d+x\d+)/);
  return resolutionMatch ? resolutionMatch[1] : undefined;
}

/**
 * 测试变体播放列表
 */
async function testVariantPlaylist(
  playlistUrl: string,
  resolution?: string
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
  isMasterPlaylist: boolean;
}> {
  try {
    const result = await testPlaylistWithActualSegments(playlistUrl);
    
    // 如果有从主播放列表获取的分辨率，优先使用
    if (resolution) {
      const res = parseResolution(resolution);
      if (res.width > 0) {
        result.quality = getQualityFromResolution(res.width, res.height);
      }
    }
    
    return {
      ...result,
      isMasterPlaylist: true
    };
  } catch (error) {
    console.warn('测试变体播放列表失败，尝试直接测试:', error);
    // 回退到直接测试
    return await testDirectPlaylist(playlistUrl, resolution);
  }
}

/**
 * 测试播放列表的实际分片（完整实现）
 */
async function testPlaylistWithActualSegments(
  playlistUrl: string
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  return new Promise((resolve, reject) => {
    // 清理之前的计时器
    fragmentStartTimes.clear();
    
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.style.display = 'none';
    document.body.appendChild(video);
    
    // 1. Ping测试（使用HEAD请求）
    const pingStart = performance.now();
    let pingTime = 0;
    
    fetch(playlistUrl, { method: 'HEAD', mode: 'no-cors' })
      .then(() => {
        pingTime = performance.now() - pingStart;
      })
      .catch(() => {
        pingTime = performance.now() - pingStart;
      })
      .finally(() => {
        // 确保pingTime有值
        if (pingTime === 0) {
          pingTime = performance.now() - pingStart;
        }
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
      console.warn('测速超时');
      cleanup();
      reject(new Error('测速超时'));
    }, 10000);
    
    // 状态变量
    let hasVideoSegmentLoaded = false;
    let totalVideoSize = 0;
    let totalVideoTime = 0;
    let segmentCount = 0;
    let videoWidth = 0;
    let videoHeight = 0;
    let speedCalculated = false;
    
    // 2. 监听分片加载开始
    hls.on(Hls.Events.FRAG_LOADING, (event: any, data: any) => {
      if (data.frag && data.frag.type === 'main') {
        // 生成唯一标识符用于追踪这个分片
        const fragId = `${data.frag.sn}-${data.frag.level}`;
        fragmentStartTimes.set(fragId, performance.now());
        
        // 也存储到frag对象上以便后续使用
        data.frag._startTime = performance.now();
      }
    });
    
    // 3. 监听分片加载完成（完整实现）
    hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
      // 只处理主视频分片，忽略音频、字幕等其他类型
      if (data.frag?.type === 'main' && data.payload) {
        const size = data.payload.byteLength || 0;
        
        // 计算加载时间（三种方法尝试获取）
        let loadTime = 0;
        const fragId = `${data.frag.sn}-${data.frag.level}`;
        
        if (fragmentStartTimes.has(fragId)) {
          // 方法1: 从Map中获取开始时间
          const startTime = fragmentStartTimes.get(fragId)!;
          loadTime = performance.now() - startTime;
          fragmentStartTimes.delete(fragId); // 清理
        } else if (data.frag._startTime) {
          // 方法2: 从frag对象获取
          loadTime = performance.now() - data.frag._startTime;
        } else {
          // 方法3: 估算（不准确）
          loadTime = 100; // 默认100ms
        }
        
        // 确保加载时间合理
        if (loadTime < 10) loadTime = 50; // 最小50ms避免除零
        if (loadTime > 10000) loadTime = 10000; // 最大10秒
        
        // 只统计有效的视频分片（大小合理）
        if (size > 1024 && loadTime > 0) { // 至少1KB
          totalVideoSize += size;
          totalVideoTime += loadTime;
          segmentCount++;
          hasVideoSegmentLoaded = true;
          
          console.log(`分片 ${segmentCount}: 大小=${formatBytes(size)}, 时间=${loadTime.toFixed(0)}ms`);
          
          // 收集2-3个分片后计算速度
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
            
            // 获取视频分辨率
            let quality = '未知';
            if (videoWidth > 0) {
              quality = getQualityFromResolution(videoWidth, videoHeight);
            } else {
              // 尝试从视频元素获取
              videoWidth = video.videoWidth;
              videoHeight = video.videoHeight;
              if (videoWidth > 0) {
                quality = getQualityFromResolution(videoWidth, videoHeight);
              }
            }
            
            console.log(`测速结果: ${quality}, ${loadSpeed}, ${Math.round(pingTime)}ms`);
            
            // 清理并返回结果
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
    
    // 4. 监听视频尺寸变化
    video.onresize = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
        console.log(`检测到视频尺寸: ${videoWidth}x${videoHeight}`);
      }
    };
    
    // 5. 监听元数据加载
    video.onloadedmetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
        console.log(`元数据加载: ${videoWidth}x${videoHeight}`);
      }
    };
    
    // 6. 监听HLS错误
    hls.on(Hls.Events.ERROR, (event: any, data: any) => {
      console.warn('HLS错误:', data);
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('网络错误，尝试恢复...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('媒体错误，尝试恢复...');
            hls.recoverMediaError();
            break;
          default:
            console.log('致命错误，停止测速');
            clearTimeout(timeout);
            cleanup();
            reject(new Error(`HLS致命错误: ${data.type}`));
            break;
        }
      }
    });
    
    // 7. 监听HLS媒体附加
    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      console.log('HLS媒体已附加');
    });
    
    // 8. 监听HLS清单加载
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('HLS清单已解析');
    });
    
    // 9. 开始加载
    try {
      hls.loadSource(playlistUrl);
      hls.attachMedia(video);
      
      // 尝试播放一点点以触发加载
      setTimeout(() => {
        if (video.paused) {
          video.play().catch(() => {
            // 静音播放失败是正常的
          });
        }
      }, 500);
    } catch (err) {
      clearTimeout(timeout);
      cleanup();
      reject(err);
    }
    
    // 10. 备用超时：如果8秒后还没有视频分片，使用备用方案
    const backupTimeout = setTimeout(() => {
      if (!hasVideoSegmentLoaded && !speedCalculated) {
        console.log('备用方案：直接测试播放列表下载速度');
        clearTimeout(timeout);
        cleanup();
        
        testPlaylistDownloadSpeed(playlistUrl)
          .then(backupResult => {
            resolve(backupResult);
          })
          .catch(() => {
            reject(new Error('测速失败'));
          });
      }
    }, 8000);
    
    // 清理函数
    function cleanup() {
      clearTimeout(backupTimeout);
      fragmentStartTimes.clear();
      
      if (hls) {
        try {
          hls.destroy();
        } catch (e) {
          console.warn('清理HLS时出错:', e);
        }
      }
      
      if (video && video.parentNode) {
        video.parentNode.removeChild(video);
      }
    }
  });
}

/**
 * 测试直接播放列表
 */
async function testDirectPlaylist(
  playlistUrl: string,
  resolution?: string
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
  isMasterPlaylist: boolean;
}> {
  try {
    const result = await testPlaylistDownloadSpeed(playlistUrl);
    
    // 如果有已知的分辨率，使用它
    if (resolution) {
      const res = parseResolution(resolution);
      if (res.width > 0) {
        result.quality = getQualityFromResolution(res.width, res.height);
      }
    }
    
    return {
      ...result,
      isMasterPlaylist: false
    };
  } catch (error) {
    console.error('直接测试失败:', error);
    return {
      quality: '未知',
      loadSpeed: '测量失败',
      pingTime: 999,
      isMasterPlaylist: false
    };
  }
}

/**
 * 备用方案：直接测试播放列表下载速度
 */
async function testPlaylistDownloadSpeed(
  url: string
): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
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
    
    // 尝试从内容中解析分辨率
    let quality = '未知';
    const resolutionMatch = content.match(/RESOLUTION=(\d+x\d+)/);
    if (resolutionMatch) {
      const res = parseResolution(resolutionMatch[1]);
      quality = getQualityFromResolution(res.width, res.height);
    } else {
      // 尝试其他方式获取分辨率
      const streamInfMatch = content.match(/#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)/);
      if (streamInfMatch) {
        const res = parseResolution(streamInfMatch[1]);
        quality = getQualityFromResolution(res.width, res.height);
      }
    }
    
    return {
      quality,
      loadSpeed,
      pingTime: Math.round(loadTime)
    };
  } catch (error) {
    console.warn('直接下载测试失败:', error);
    return {
      quality: '未知',
      loadSpeed: '测量失败',
      pingTime: Math.round(performance.now() - startTime)
    };
  }
}

/**
 * 根据分辨率获取质量等级
 */
function getQualityFromResolution(width: number, height: number): string {
  if (width >= 3840 || height >= 2160) return '4K';
  if (width >= 2560 || height >= 1440) return '2K';
  if (width >= 1920 || height >= 1080) return '1080p';
  if (width >= 1280 || height >= 720) return '720p';
  if (width >= 854 || height >= 480) return '480p';
  if (width > 0 || height > 0) return 'SD';
  return '未知';
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
