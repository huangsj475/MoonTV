/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

'use client';

import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { Heart } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  deleteSkipConfig,
  generateStorageKey,
  getAllPlayRecords,
  getSkipConfig,
  isFavorited,
  saveFavorite,
  savePlayRecord,
  saveSkipConfig,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';

import EpisodeSelector from '@/components/EpisodeSelector';
import PageLayout from '@/components/PageLayout';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  // 新增状态用于跟踪播放记录是否已加载----------------------------------------
  const [playRecordLoaded, setPlayRecordLoaded] = useState(false);
  const [loadingStage, setLoadingStage] = useState<
    'searching' | 'preferring' | 'fetching' | 'ready'
  >('searching');
  const [loadingMessage, setLoadingMessage] = useState('正在搜索播放源...');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const isChangingEpisodeRef = useRef(false)//---新增：是否正在切换集数
  const skipIntroProcessedRef = useRef(false);//---新增：是否跳过片头或者恢复进度
  //const outroCheckStartedRef = useRef(false);//---新增：是否跳过片尾
  const videoReadyRef = useRef(false)//新增：视频准备状态，由于初次加载hls会初始化，加载2次hls，导致恢复进度后被重置
  const levelSwitchCountRef = useRef(0);
  


  // 收藏状态
  const [favorited, setFavorited] = useState(false);

  // 跳过片头片尾配置
  const [skipConfig, setSkipConfig] = useState<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });
  const skipConfigRef = useRef(skipConfig);
  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [
    skipConfig,
    skipConfig.enable,
    skipConfig.intro_time,
    skipConfig.outro_time,
  ]);

  // 去广告开关（从 localStorage 继承，默认 true）
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 视频基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  // 当前源和ID
  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || ''
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');

  // 搜索所需信息
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');

  // 是否需要优选
  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true'
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);
  // 集数相关
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);

  // 同步最新值到 refs
  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
  }, [
    currentSource,
    currentId,
    detail,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
  ]);

// 智能提取剧集/期数名称
const extractEpisodeTitle = (
  originalUrl: string, 
  currentEpisodeIndex: number, 
  totalEpisodes: number,
  typeName?: string // 从detail.type_name获取
): string => {
  const { episodeName } = parseEpisodeUrl(originalUrl);
  
  // 如果没有集名称，直接返回数字格式
  if (!episodeName) {
    return `第 ${currentEpisodeIndex + 1}/${totalEpisodes} 集`;
  }
  
  // 1. 判断是否为电视剧类型（包含"剧"字）
  if (typeName && typeName.includes('剧')) {
    // 电视剧：强制显示"第 X/X 集"格式
    return `第 ${currentEpisodeIndex + 1}/${totalEpisodes} 集`;
  }
  
  // 2. 判断是否为综艺类型（包含"综艺"）
  if (typeName && typeName.includes('综艺')) {
    // 综艺：显示原名称
    return `${episodeName} - 第 ${currentEpisodeIndex + 1}/${totalEpisodes} 集`;
  }
  
  // 3. 如果type_name为空，用正则判断
  if (!typeName) {
    // 正则匹配电视剧常见格式
    const tvPatterns = [
      /^第?\s*\d+\s*集$/,      // 第1集, 第01集, 1集, 01集
      /^第?\s*\d+\s*$/,        // 第1, 01
      /^\d{1,3}$/,            // 1, 01, 123（1-3位数字）
    ];
    
    // 检查是否匹配电视剧格式
    const isTVFormat = tvPatterns.some(pattern => pattern.test(episodeName));
    
    if (isTVFormat) {
      // 匹配电视剧格式，显示数字格式
      return `第 ${currentEpisodeIndex + 1}/${totalEpisodes} 集`;
    } else {
      // 不匹配电视剧格式，认为属于综艺，显示原名称
      return `${episodeName} - 第 ${currentEpisodeIndex + 1}/${totalEpisodes} 集`;
    }
  }
  
  // 4. 其他情况（既不是剧也不是综艺，比如电影、动漫等）
  // 对于非剧非综艺也显示数字格式（比如电影只有1集）
  return `第 ${currentEpisodeIndex + 1}/${totalEpisodes} 集`;
  
};
	
  //------------手机端播放双击事件优化----------------
  
  //左边快退，中间暂停，右边快进
  // 工具函数：判断是否移动端
const isMobile = () =>
  typeof window !== 'undefined' &&
  (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

// 双击事件处理
const handleMobileDoubleTap = (e: React.TouchEvent<HTMLDivElement>) => {
  const rect = artRef.current?.getBoundingClientRect();
  if (!rect) return;
  const touch = e.changedTouches[0];
  const x = touch.clientX - rect.left;
  const area = x / rect.width;

  if (!artPlayerRef.current) return;

  // 划分区域：左（0~0.33），中（0.33~0.66），右（0.66~1）
  if (area < 0.33) {
    // 快退10秒
    artPlayerRef.current.currentTime = Math.max(artPlayerRef.current.currentTime - 10, 0);
    artPlayerRef.current.notice.show = '快退10秒';
  } else if (area > 0.66) {
    // 快进10秒
    artPlayerRef.current.currentTime = Math.min(
      artPlayerRef.current.currentTime + 10,
      artPlayerRef.current.duration || artPlayerRef.current.currentTime + 10
    );
    artPlayerRef.current.notice.show = '快进10秒';
  } else {
    // 暂停/播放
    artPlayerRef.current.toggle();
  }
};
  //------------手机端播放双击事件优化----------------
  
//-----------正则匹配视频地址显示每一集名称---------------
// 统一的URL解析函数
const parseEpisodeUrl = (url: string): { episodeName: string | null; videoUrl: string } => {
  if (!url) return { episodeName: null, videoUrl: url };
  
  try {
    // 使用与后端相同的正则逻辑
    const parts = url.split('$');
    if (parts.length >= 2) {
      let partepisodeName = parts[0].trim();
      const partUrl = parts.slice(1).join('$');
      
      // 检查是否是m3u8 URL
      if (partUrl.includes('.m3u8')) {
		partepisodeName = partepisodeName.replace(/-|\.|\s/g, '');// 移除episodeName中的所有短横线，小数点，空格
        return {
          episodeName: partepisodeName,
          videoUrl: partUrl
        };
      }
    }
  } catch (error) {
    console.error('解析URL失败:', error);
  }
  
  return { episodeName: null, videoUrl: url };
};
//------------------到这里----------------------------


  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');

  // 总集数
  const totalEpisodes = detail?.episodes?.length || 0;

  // 用于记录是否需要在播放器 ready 后跳转到指定进度
  const resumeTimeRef = useRef<number>(0);
  // 上次使用的音量，默认 0.7
  const lastVolumeRef = useRef<number>(0.7);
  // 上次使用的播放速率，默认 1.0
  const lastPlaybackRateRef = useRef<number>(1.0);

  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(
    null
  );

  // 优选和测速开关
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  // 保存优选时的测速结果，避免EpisodeSelector重复测速
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<string, { quality: string; loadSpeed: string; pingTime: number }>
  >(new Map());

  // 折叠状态（仅在 lg 及以上屏幕有效）
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(false);

  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const artPlayerRef = useRef<any>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  // -----------------------------------------------------------------------------
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // 播放源优选函数
  const preferBestSource = async (
    sources: SearchResult[]
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    // 将播放源均分为两批，并发测速各批，避免一次性过多请求
    const batchSize = Math.ceil(sources.length / 2);
    const allResults: Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    } | null> = [];

    for (let start = 0; start < sources.length; start += batchSize) {
      const batchSources = sources.slice(start, start + batchSize);
      const batchResults = await Promise.all(
        batchSources.map(async (source) => {
          try {
            // 检查是否有第一集的播放地址
            if (!source.episodes || source.episodes.length === 0) {
              console.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
              return null;
            }

            const episodeUrl =
              source.episodes.length > 1
                ? source.episodes[1]
                : source.episodes[0];
			  // 解析URL获取真实的视频地址
          const { videoUrl: testUrl } = parseEpisodeUrl(episodeUrl);
          
          if (!testUrl) {
            console.warn(`播放源 ${source.source_name} 的URL解析失败`);
            return null;
          }

          const testResult = await getVideoResolutionFromM3u8(testUrl);
            
            return {
              source,
              testResult,
            };
          } catch (error) {
            return null;
          }
        })
      );
      allResults.push(...batchResults);
    }

    // 等待所有测速完成，包含成功和失败的结果
    // 保存所有测速结果到 precomputedVideoInfo，供 EpisodeSelector 使用（包含错误结果）
    const newVideoInfoMap = new Map<
      string,
      {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        hasError?: boolean;
      }
    >();
    allResults.forEach((result, index) => {
      const source = sources[index];
      const sourceKey = `${source.source}-${source.id}`;

      if (result) {
        // 成功的结果
        newVideoInfoMap.set(sourceKey, result.testResult);
      }
    });

    // 过滤出成功的结果用于优选计算
    const successfulResults = allResults.filter(Boolean) as Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    }>;

    setPrecomputedVideoInfo(newVideoInfoMap);

    if (successfulResults.length === 0) {
      console.warn('所有播放源测速都失败，使用第一个播放源');
      return sources[0];
    }

    // 找出所有有效速度的最大值，用于线性映射
    const validSpeeds = successfulResults
      .map((result) => {
        const speedStr = result.testResult.loadSpeed;
        if (speedStr === '未知' || speedStr === '测量中...') return 0;

        const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2];
        return unit === 'MB/s' ? value * 1024 : value; // 统一转换为 KB/s
      })
      .filter((speed) => speed > 0);

    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024; // 默认1MB/s作为基准

    // 找出所有有效延迟的最小值和最大值，用于线性映射
    const validPings = successfulResults
      .map((result) => result.testResult.pingTime)
      .filter((ping) => ping > 0);

    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    // 计算每个结果的评分
    const resultsWithScore = successfulResults.map((result) => ({
      ...result,
      score: calculateSourceScore(
        result.testResult,
        maxSpeed,
        minPing,
        maxPing
      ),
    }));

    // 按综合评分排序，选择最佳播放源
    resultsWithScore.sort((a, b) => b.score - a.score);

    console.log('播放源评分排序结果:');
    resultsWithScore.forEach((result, index) => {
      console.log(
        `${index + 1}. ${
          result.source.source_name
        } - 评分: ${result.score.toFixed(2)} (${result.testResult.quality}, ${
          result.testResult.loadSpeed
        }, ${result.testResult.pingTime}ms)`
      );
    });

    return resultsWithScore[0].source;
  };

  // 计算播放源综合评分
  const calculateSourceScore = (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number
  ): number => {
    let score = 0;

    // 分辨率评分 (40% 权重)
    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 85;
        case '1080p':
          return 75;
        case '720p':
          return 60;
        case '480p':
          return 40;
        case 'SD':
          return 20;
        default:
          return 0;
      }
    })();
    score += qualityScore * 0.4;

    // 下载速度评分 (40% 权重) - 基于最大速度线性映射
    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;

      // 解析速度值
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      // 基于最大速度线性映射，最高100分
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.4;

    // 网络延迟评分 (20% 权重) - 基于延迟范围线性映射
    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0; // 无效延迟给默认分

      // 如果所有延迟都相同，给满分
      if (maxPing === minPing) return 100;

      // 线性映射：最低延迟=100分，最高延迟=0分
      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.2;

    return Math.round(score * 100) / 100; // 保留两位小数
  };

  // 更新视频地址
  const updateVideoUrl = (
    detailData: SearchResult | null,
    episodeIndex: number
  ) => {
    if (
      !detailData ||
      !detailData.episodes ||
      episodeIndex >= detailData.episodes.length
    ) {
      setVideoUrl('');
      return;
    }
    const newUrl = detailData?.episodes[episodeIndex] || '';
	  // 修复：使用解析后的真实视频URL
  const { videoUrl: parsedUrl } = parseEpisodeUrl(newUrl);
    if (parsedUrl !== videoUrl) {
      setVideoUrl(parsedUrl);
    }
  };

  const ensureVideoSource = (video: HTMLVideoElement | null, url: string) => {
    if (!video || !url) return;
    const sources = Array.from(video.getElementsByTagName('source'));
    const existed = sources.some((s) => s.src === url);
    if (!existed) {
      // 移除旧的 source，保持唯一
      sources.forEach((s) => s.remove());
      const sourceEl = document.createElement('source');
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }

    // 始终允许远程播放（AirPlay / Cast）
    video.disableRemotePlayback = false;
    // 如果曾经有禁用属性，移除之
    if (video.hasAttribute('disableRemotePlayback')) {
      video.removeAttribute('disableRemotePlayback');
    }
  };

	// 新版去广告函数
/*function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';
  
  const lines = m3u8Content.split('\n');
  const linesToRemove = new Set<number>();
  
  // 收集所有ts文件信息（包含行号）
  const allTsInfo: Array<{
    extinfLine: number;  // #EXTINF行号
    tsLine: number;      // ts文件行号
    name: string;       // 文件名（不含.ts）
    num: number; // 提取的数字
  }> = [];

  // 1. 条件1：检查所有ts文件名数字是否连续递增
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      if (i + 1 < lines.length) {
        const tsLine = lines[i + 1].trim();
        const tsMatch = tsLine.match(/^([^?]+)\.ts(\?.*)?$/);
        if (tsMatch) {
          const name = tsMatch[1]; // 获取.ts前的文件名部分
          const num = extractTsNumber(name);
          
          allTsInfo.push({
            extinfLine: i,      // #EXTINF行
            tsLine: i + 1,      // ts文件行
            name: name,
            num: num
          });
          i++; // 跳过ts行
        }
      }
    }
  }
  
  console.log(`共找到 ${allTsInfo.length} 个ts文件`);
  
  // 条件1：检查ts文件名数字是否连续递增
  console.log('检查条件1：ts文件名数字是否连续递增...');
  
  if (allTsInfo.length >= 2) {
  
      const numbers = allTsInfo.map(info => info.num!);
	  //const names = allTsInfo.map(info => info.name!);
      //console.log(`数字序列: [${numbers.join(', ')}]`);
	  //console.log(`ts名序列: [${names.join(', ')}]`);
      
      // 检查是否递增（每个数字都比前一个大）只看前5个是否是连续即可
      let isIncreasing = true;
      for (let i = 1; i < 6; i++) {
        if (numbers[i] <= numbers[i-1]) {
          isIncreasing = false;
          console.log(`不递增: ${numbers[i-1]} -> ${numbers[i]}`);
          break;
        }
      }
      
	if (isIncreasing) {
	  console.log('√ 条件1触发：ts文件名数字递增');
	  console.log('删除不连续的ts文件和所有 discontinuity 标签...');
	  
	  // 1. 删除所有 #EXT-X-DISCONTINUITY 标签
		let totaldiscontinuity = 0;
	  for (let i = 0; i < lines.length; i++) {
	    if (lines[i].trim() === '#EXT-X-DISCONTINUITY') {
	      linesToRemove.add(i);
		  totaldiscontinuity++;
	    }
	  }
		if (totaldiscontinuity > 0) {
		  console.log(`✓ 总计删除了 ${totaldiscontinuity} 个 discontinuity 标签`);
		} else {
		  console.log('× 未找到 discontinuity 标签');
		}
	  // 2. 删除不连续的ts文件块
	  // 找到所有不连续的段落
		const removedFiles: string[] = [];
	  for (let i = 1; i < numbers.length; i++) {
		  const num = numbers[i];
		  
		if (num === 0 || num > 100000) {
			const tsInfo = allTsInfo[i];
      linesToRemove.add(tsInfo.extinfLine);
      linesToRemove.add(tsInfo.tsLine);
	  removedFiles.push(`${tsInfo.name}.ts (行${tsInfo.tsLine + 1}, 数字: ${num})`);
		}
	  }
        if (removedFiles.length > 0) {
          console.log('删除的异常ts文件:');
          removedFiles.forEach(file => console.log(` - ${file}`));
        } else {
          console.log('没有发现异常的ts文件');
        }
	  
	  console.log('条件1完成，返回过滤结果');
	  return buildResult(lines, linesToRemove);
	} else {
        console.log('× 条件1不满足：ts文件名数字不递增');
      }
     
  } else {
    console.log('× 条件1不满足：ts文件少于2个');
  }
  
  console.log('× 条件1不满足，执行条件2...');

	//条件2不完善，先暂时不用
  // 2. 条件2：按discontinuity分组检查ts数量
    // 定义类型
  /*type Section = {
    start: number;
    count: number;
    lines: number[];
  };
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '#EXT-X-DISCONTINUITY') {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        start: i,
        count: 0,
        lines: [i] // 包含discontinuity标签行
      };
    } else if (currentSection && line.startsWith('#EXTINF:')) {
      currentSection.count++;
      currentSection.lines.push(i); // EXTINF行
      
      if (i + 1 < lines.length && lines[i + 1].trim().endsWith('.ts')) {
        currentSection.lines.push(i + 1); // ts文件行
        i++;
      }
    }
  }
  
  if (currentSection) {
    sections.push(currentSection);
  }
  
  console.log(`找到 ${sections.length} 个discontinuity段`);

  if (sections.length > 1) {
    const counts = sections.map(s => s.count);
    const maxCount = Math.max(...counts);
    console.log(`最大ts数量: ${maxCount}`);

	  // 分别存储正常段和广告段信息
	  const normalSections: Array<{index: number, section: Section}> = [];
	  const adSections: Array<{index: number, section: Section}> = [];
    // 找出广告段
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // 广告段判断：ts数量少于10且小于最大值的1/5
      if (section.count < 10 && section.count < maxCount / 5) {
		  adSections.push({index: i + 1, section});
        //console.log(`√ 段 ${i + 1} 是广告段: ${section.count}个ts`);
        // 删除整个广告段
        section.lines.forEach((lineNum: number) => {
          linesToRemove.add(lineNum);
        });
      } else {
		  normalSections.push({index: i + 1, section});
        //console.log(`× 段 ${i + 1} 是正常段: ${section.count}个ts`);
        // 正常段只删除discontinuity标签
        linesToRemove.add(section.start);
      }
    }
		    // 输出正常段
	  if (normalSections.length > 0) {
	  const normalList = normalSections.map(item => `段${item.index}:${item.section.count}个ts`).join(', ');
	  console.log(`${normalSections.length}个正常段: [${normalList}]`);
	  }
	  // 输出广告段
	  if (adSections.length > 0) {
	  const adList = adSections.map(item => `段${item.index}:${item.section.count}个ts`).join(', ');
	  console.log(`${adSections.length}个广告段: [${adList}]`);
	  }
  } else if (sections.length === 1) {
    console.log('只有一个段，只删除discontinuity标签');
    linesToRemove.add(sections[0].start);
  }*/
	  //  其他条件：删除所有 #EXT-X-DISCONTINUITY 标签
		/*let totaldiscontinuity = 0;
	  for (let i = 0; i < lines.length; i++) {
	    if (lines[i].trim() === '#EXT-X-DISCONTINUITY') {
	      linesToRemove.add(i);
		  totaldiscontinuity++;
	    }
	  }
		if (totaldiscontinuity > 0) {
		  console.log(`✓ 总计删除了 ${totaldiscontinuity} 个 discontinuity 标签`);
		} else {
		  console.log('× 未找到 discontinuity 标签');
		}
 return buildResult(lines, linesToRemove);
}*/

/*function extractTsNumber(name: string): number {
  // 先检查是否是纯hash格式（32位十六进制）
  if (/^[0-9a-f]{32}$/i.test(name)) {
    return 0;
  }
  // 检查是否是纯数字
  if (/^\d+$/.test(name)) {
    const num = parseInt(name, 10);
    return num;
  }
  // 对于包含字母和数字的混合文件名
  // 策略：优先找末尾的连续数字
  const endDigits = name.match(/(\d+)$/);
  if (endDigits) {
    const num = parseInt(endDigits[1], 10);
    return num;
  }
  
  return 0;
}*/
/*function buildResult(lines: string[], linesToRemove: Set<number>): string {
  const result: string[] = [];
  let keptCount = 0;
  let removedCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (!linesToRemove.has(i)) {
      result.push(lines[i]);
      keptCount++;
    } else {
      removedCount++;
    }
  }
  
  console.log(`原始行数: ${lines.length}, 保留行数: ${keptCount}, 删除行数: ${removedCount}`);
  return result.join('\n');
}*/
	
  // 去广告相关函数
  function filterAdsFromM3U8(m3u8Content: string): string {
    if (!m3u8Content) return '';

    // 按行分割M3U8内容
    const lines = m3u8Content.split('\n');
    const filteredLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 只过滤#EXT-X-DISCONTINUITY标识
      if (!line.includes('#EXT-X-DISCONTINUITY')) {
        filteredLines.push(line);
      }	  
    }
    return filteredLines.join('\n');
  }

  // 跳过片头片尾配置相关函数
  const handleSkipConfigChange = async (newConfig: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }) => {
    if (!currentSourceRef.current || !currentIdRef.current) return;

    try {
      setSkipConfig(newConfig);
      if (!newConfig.enable && !newConfig.intro_time && !newConfig.outro_time) {
        await deleteSkipConfig(currentSourceRef.current, currentIdRef.current);
        artPlayerRef.current.setting.update({
          name: '跳过片头片尾',
          html: '跳过片头片尾',
          switch: skipConfigRef.current.enable,
          onSwitch: function (item: any) {
            const newConfig = {
              ...skipConfigRef.current,
              enable: !item.switch,
            };
            handleSkipConfigChange(newConfig);
            return !item.switch;
          },
        });
        artPlayerRef.current.setting.update({
          name: '设置片头',
          html: '设置片头',
          icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="#ffffff"/><path d="M9 12L17 12" stroke="#ffffff" stroke-width="2"/><path d="M17 6L17 18" stroke="#ffffff" stroke-width="2"/></svg>',
          tooltip:
            skipConfigRef.current.intro_time === 0
              ? '设置片头时间'
              : `${formatTime(skipConfigRef.current.intro_time)}(点击删除)`,
          onClick: function () {
            const currentTime = artPlayerRef.current?.currentTime || 0;
			  const currentIntroTime = skipConfigRef.current.intro_time;
			  	// 如果有设置，直接删除
			    if (currentIntroTime > 0) {
			        const newConfig = {
			          ...skipConfigRef.current,
			          intro_time: 0,
			        };
			        handleSkipConfigChange(newConfig);
			        artPlayerRef.current.notice.show = '已删除片头配置';
			        return '';
			    }
            if (currentTime > 0) {
              const newConfig = {
                ...skipConfigRef.current,
                intro_time: currentTime,
              };
              handleSkipConfigChange(newConfig);
              return `${formatTime(currentTime)}(点击删除)`;
            }
          },
        });
        artPlayerRef.current.setting.update({
          name: '设置片尾',
          html: '设置片尾',
          icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6L7 18" stroke="#ffffff" stroke-width="2"/><path d="M7 12L15 12" stroke="#ffffff" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="#ffffff"/></svg>',
          tooltip:
            skipConfigRef.current.outro_time >= 0
              ? '设置片尾时间'
              : `-${formatTime(-skipConfigRef.current.outro_time)}(点击删除)`,
          onClick: function () {
					const currentOutroTime = skipConfigRef.current.outro_time;
					    // 如果有设置，直接删除
				    if (currentOutroTime < 0) {
				        const newConfig = {
				          ...skipConfigRef.current,
				          outro_time: 0,
				        };
				        handleSkipConfigChange(newConfig);
				        artPlayerRef.current.notice.show = '已删除片尾配置';
				      return '';
				    }
            const outroTime =
              -(
                artPlayerRef.current?.duration -
                artPlayerRef.current?.currentTime
              ) || 0;
            if (outroTime < 0) {
              const newConfig = {
                ...skipConfigRef.current,
                outro_time: outroTime,
              };
              handleSkipConfigChange(newConfig);
              return `-${formatTime(-skipConfigRef.current.outro_time)}(点击删除)`;
            }
          },
        });
      } else {
        await saveSkipConfig(
          currentSourceRef.current,
          currentIdRef.current,
          newConfig
        );
      }
      console.log('跳过片头片尾配置已保存:', newConfig);
    } catch (err) {
      console.error('保存跳过片头片尾配置失败:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (hours === 0) {
      // 不到一小时，格式为 00:00
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      // 超过一小时，格式为 00:00:00
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
	  const load = this.load.bind(this);
      this.load = function (context: any, config: any, callbacks: any) {
        // 拦截manifest和level请求
        if (
          (context as any).type === 'manifest' ||
          (context as any).type === 'level'
        ) {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (
            response: any,
            stats: any,
            context: any
          ) {
            // 如果是m3u8文件，处理内容以移除广告分段
            if (response.data && typeof response.data === 'string') {
              // 过滤掉广告段 - 实现更精确的广告过滤逻辑
              response.data = filterAdsFromM3U8(response.data);
            }
            return onSuccess(response, stats, context, null);
          };
        }
        // 执行原始load方法
        load(context, config, callbacks);
      };
    }
  }

  // 当集数索引变化时自动更新视频地址
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
	  
  }, [detail, currentEpisodeIndex]);

  // 进入页面时直接获取全部源信息
  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string
    ): Promise<SearchResult[]> => {
      try {
        const detailResponse = await fetch(
          `/api/detail?source=${source}&id=${id}`
        );
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
        const detailData = (await detailResponse.json()) as SearchResult;
        setAvailableSources([detailData]);
        return [detailData];
      } catch (err) {
        console.error('获取视频详情失败:', err);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };
    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      // 根据搜索词获取全部源信息
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        const data = await response.json();

        // 处理搜索结果，根据规则过滤
        const results = data.results.filter(
          (result: SearchResult) =>
            result.title.replaceAll(' ', '').toLowerCase() ===
              videoTitleRef.current.replaceAll(' ', '').toLowerCase() &&
            (videoYearRef.current
              ? result.year.toLowerCase() === videoYearRef.current.toLowerCase()
              : true) &&
            (searchType
              ? (searchType === 'tv' && result.episodes.length > 1) ||
                (searchType === 'movie' && result.episodes.length === 1)
              : true)
        );
        setAvailableSources(results);
        return results;
      } catch (err) {
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const initAll = async () => {
      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }
      setLoading(true);
      
      // --- 阶段 2: 获取视频详情 ---
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...'
      );
    
      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      if (
        currentSource &&
        currentId &&
        !sourcesInfo.some(
          (source) => source.source === currentSource && source.id === currentId
        )
      ) {
        sourcesInfo = await fetchSourceDetail(currentSource, currentId);
      }
      if (sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      let detailData: SearchResult = sourcesInfo[0];
      
      // 指定源和id且无需优选
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) => source.source === currentSource && source.id === currentId
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      // --- 阶段 3: 源优选（如果开启）---
      // 未指定源和 id 或需要优选，且开启优选开关
      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('⚡ 正在优选最佳播放源...');

        detailData = await preferBestSource(sourcesInfo);
      }

      console.log(detailData.source, detailData.id);

      setNeedPrefer(false);
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      // 规范URL参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      // --- 阶段 4: 完成准备 ---
      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪，即将开始播放...');

      // 短暂延迟让用户看到完成状态
      setTimeout(() => {
        setLoading(false);
      }, 500);
    };

   initAll();
  }, []);

  //-----------3.新添加-------------
 // 确保播放器销毁时保存进度
// 在播放器销毁前确保保存进度
useEffect(() => {
  return () => {
    if (artPlayerRef.current) {
      saveCurrentPlayProgress();
	  console.log('播放器销毁前---播放进度已保存');

      if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
        artPlayerRef.current.video.hls.destroy();
		console.log('播放进度已保存后---播放器视频流hls销毁');
      }
      
      if (typeof artPlayerRef.current.destroy === 'function') {
        artPlayerRef.current.destroy();
		artPlayerRef.current = null;
		console.log('播放进度已保存后---播放器销毁');
      }
    }
    
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
    }
  };
}, []);//-----------3.新添加-------------

  // 播放记录处理
  useEffect(() => {
  //if (!currentSource || !currentId) return;------换到下面行---------原来的---------
    
  const initFromHistory = async () => {
    if (!currentSource || !currentId) return;//--------改后的-------------
    try {
      const allRecords = await getAllPlayRecords();
      const key = generateStorageKey(currentSource, currentId);
      const record = allRecords[key];
      if (record) {
        const targetIndex = record.index - 1;
        const targetTime = record.play_time;
        if (targetIndex !== currentEpisodeIndex) {
          setCurrentEpisodeIndex(targetIndex);
        }
        resumeTimeRef.current = targetTime;
        console.log('加载播放记录:', targetTime);
      }
    } catch (err) {
      console.error('读取播放记录失败:', err);
    } finally {
      // 标记播放记录已加载完成
      setPlayRecordLoaded(true);
    }
  };

  initFromHistory();
}, [currentSource, currentId]);
	
  // 跳过片头片尾配置处理
  useEffect(() => {
    // 仅在初次挂载时检查跳过片头片尾配置
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;

      try {
        const config = await getSkipConfig(currentSource, currentId);
        if (config) {
          setSkipConfig(config);
        }
      } catch (err) {
        console.error('读取跳过片头片尾配置失败:', err);
      }
    };

    initSkipConfig();
  }, []);

  // 处理换源
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string
  ) => {
    try {
      // 显示换源加载状态
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);

      // 记录当前播放进度（仅在同一集数切换时恢复）
      const currentPlayTime = artPlayerRef.current?.currentTime || 0;
      console.log('换源前当前播放时间:', currentPlayTime);

      // 清除前一个历史记录
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(
            currentSourceRef.current,
            currentIdRef.current
          );
          console.log('已清除前一个播放记录');
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      // 清除并设置下一个跳过片头片尾配置
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deleteSkipConfig(
            currentSourceRef.current,
            currentIdRef.current
          );
          await saveSkipConfig(newSource, newId, skipConfigRef.current);
        } catch (err) {
          console.error('清除跳过片头片尾配置失败:', err);
        }
      }

      const newDetail = availableSources.find(
        (source) => source.source === newSource && source.id === newId
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      // 尝试跳转到当前正在播放的集数
      let targetIndex = currentEpisodeIndex;

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      // 如果仍然是同一集数且播放进度有效，则在播放器就绪后恢复到原始进度
      if (targetIndex !== currentEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      // 更新URL参数（不刷新页面）
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      window.history.replaceState({}, '', newUrl.toString());

      setVideoTitle(newDetail.title || newTitle);
      setVideoYear(newDetail.year);
      setVideoCover(newDetail.poster);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 集数切换
  // ---------------------------------------------------------------------------
  // 处理集数切换
  const handleEpisodeChange = async (episodeindexNumber: number) => {
  if (episodeindexNumber >= 0 && episodeindexNumber < totalEpisodes) {
	  
    // 在更换集数前保存当前播放进度
    /*if (artPlayerRef.current && artPlayerRef.current.paused) {
      saveCurrentPlayProgress();
    }*/
    // 新增：查询历史记录，并设置 resumeTimeRef
    const allRecords = await getAllPlayRecords();
    const key = generateStorageKey(currentSource, currentId);
    const record = allRecords[key];
    if (record && record.index - 1 === episodeindexNumber) {
      resumeTimeRef.current = record.play_time;
    } else {
      resumeTimeRef.current = 0;
    }
	videoReadyRef.current = true;//切换集数可以立即恢复进度
    setCurrentEpisodeIndex(episodeindexNumber);
  }
};

  const handlePreviousEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      /*if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
		console.log('上一集---播放进度已保存');
      }*/
	  videoReadyRef.current = true;//切换集数可以立即恢复进度
      setCurrentEpisodeIndex(idx - 1);
    }
  };

  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      /*if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
		console.log('下一集---播放进度已保存');
      }*/
	  videoReadyRef.current = true;//切换集数可以立即恢复进度
      setCurrentEpisodeIndex(idx + 1);
    }
  };

  // ---------------------------------------------------------------------------
  // 键盘快捷键
  // ---------------------------------------------------------------------------
  // 处理全局快捷键
  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    // 忽略输入框中的按键事件
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        e.preventDefault();
      }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        e.preventDefault();
      }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
      if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
        artPlayerRef.current.currentTime -= 10;
        e.preventDefault();
      }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
      if (
        artPlayerRef.current &&
        artPlayerRef.current.currentTime < artPlayerRef.current.duration - 5
      ) {
        artPlayerRef.current.currentTime += 10;
        e.preventDefault();
      }
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume + 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100
        )}`;
        e.preventDefault();
      }
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume - 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100
        )}`;
        e.preventDefault();
      }
    }

    // 空格 = 播放/暂停
    if (e.key === ' ' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (artPlayerRef.current) {
        artPlayerRef.current.toggle();
        e.preventDefault();
      }
    }

    // f 键 = 切换全屏
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      if (artPlayerRef.current) {
        artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
        e.preventDefault();
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 播放记录相关
  // ---------------------------------------------------------------------------
  // 保存播放进度
  const saveCurrentPlayProgress = async () => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }


    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: Math.floor(currentTime),
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
		remarks: detailRef.current?.remarks || '',
      });

      lastSaveTimeRef.current = Date.now();
      console.log('播放进度已保存:', {
        title: videoTitleRef.current,
        episode: currentEpisodeIndexRef.current + 1,
        year: detailRef.current?.year,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };

      useEffect(() => {
    // 页面即将卸载时保存播放进度(刷新)
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress();
	  console.log('页面即将卸载时---播放进度已保存');
    if (artPlayerRef.current) {
      if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
        artPlayerRef.current.video.hls.destroy();
      }
      // 销毁播放器实例
      //artPlayerRef.current.destroy();
      //artPlayerRef.current = null;
    }
    };

 
    // 页面可见性变化时保存播放进度
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress();
		console.log('页面隐藏---播放进度已保存');
      }else if (document.visibilityState === 'visible') {//---------新添加开始-----------
      // 页面重新可见时，重新检查播放进度
      if (currentSource && currentId) {
        getAllPlayRecords().then(allRecords => {
          const key = generateStorageKey(currentSource, currentId);
          const record = allRecords[key];
          if (record && artPlayerRef.current) {
            // 如果播放器存在且当前时间与记录相差较大，恢复进度
            const currentTime = artPlayerRef.current.currentTime || 0;
            if (Math.abs(currentTime - record.play_time) > 30) {
              artPlayerRef.current.currentTime = record.play_time;
            }
          }
        });
      }
    }//---------新添加到这里-----------
     
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentSource, currentId]);//-----------新添加两个currentSource, currentId---------------------------

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 收藏相关
  // ---------------------------------------------------------------------------
  // 每当 source 或 id 变化时检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentId) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      }
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    )
      return;

    try {
      if (favorited) {
        // 如果已收藏，删除收藏
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        // 如果未收藏，添加收藏
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  useEffect(() => {
    if (
      !Artplayer ||
      !Hls ||
      !videoUrl ||
      loading ||
      currentEpisodeIndex === null ||
      !artRef.current ||
      !playRecordLoaded
    ) {
      return;
    }

    // 确保选集索引有效
    if (
      !detail ||
      !detail.episodes ||
      currentEpisodeIndex >= detail.episodes.length ||
      currentEpisodeIndex < 0
    ) {
      setError(`选集索引无效，当前共 ${totalEpisodes} 集`);
      return;
    }

    if (!videoUrl) {
      setError('视频地址无效');
      return;
    }
    console.log(videoUrl);
	  //视频播放前设置正在切换状态，否则播放器会自动触发暂停，然后保存进度
    isChangingEpisodeRef.current = true;
  
    // 检测是否为WebKit浏览器
    const isWebkit =
      typeof window !== 'undefined' &&
      typeof (window as any).webkitConvertPointFromNodeToPage === 'function';

	      // 切换视频后重置跳过状态
	skipIntroProcessedRef.current = false;
	  levelSwitchCountRef.current = 0;
	  
    // 非WebKit浏览器且播放器已存在，使用switch方法切换
   if (!isWebkit && artPlayerRef.current) {
	  const originalUrl = detail?.episodes[currentEpisodeIndex] || '';
      const { videoUrl: realVideoUrl } = parseEpisodeUrl(originalUrl);
	  artPlayerRef.current.switch = realVideoUrl;

	  const episodeText = extractEpisodeTitle(
	    originalUrl,
	    currentEpisodeIndex,
	    totalEpisodes,
	    detail?.type_name
	  );
	  artPlayerRef.current.title = `${videoTitle} - ${episodeText}`;
      
      artPlayerRef.current.poster = videoCover;
		if (artPlayerRef.current?.video) {
		  const { videoUrl: realVideoUrl } = parseEpisodeUrl(videoUrl);
		  ensureVideoSource(
			artPlayerRef.current.video as HTMLVideoElement,
			realVideoUrl
		  );
		}
      return;
    }
    
    // WebKit浏览器或首次创建：销毁之前的播放器实例并创建新的
    if (artPlayerRef.current) {
      if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
        artPlayerRef.current.video.hls.destroy();
      }
      // 销毁播放器实例
      artPlayerRef.current.destroy();
      artPlayerRef.current = null;
    
    }

    try {
      // 创建新的播放器实例
      Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
      Artplayer.USE_RAF = true;
     
      artPlayerRef.current = new Artplayer({
        container: artRef.current,
        url: parseEpisodeUrl(videoUrl).videoUrl,// 使用真实的视频URL
        poster: videoCover,
        volume: 0.7,
        isLive: false,
        muted: false,
        autoplay: false,
        pip: true,
        autoSize: false,
        autoMini: false,
        screenshot: false,
        setting: true,
        loop: false,
        flip: false,
        playbackRate: true,
		aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: false,
        mutex: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        theme: '#22c55e',
        lang: 'zh-cn',
        hotkey: false,
        fastForward: true,
        autoOrientation: true,
        lock: true,
        moreVideoAttr: {
          crossOrigin: 'anonymous',
        },
        //-------新增标题-------------
         layers: [
    {
      name: 'custom-title-layer',
      html: `<div id="artplayer-title-layer" style="
        position: absolute;
        top: 10px;
        left: 75px;
        width: 100%;
        font-size: 1rem;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 0 8px #000;
        pointer-events: none;
        z-index: 13;
        ">
      ${(() => {
        const originalUrl = detail?.episodes[currentEpisodeIndex] || '';
        const episodeText = extractEpisodeTitle(
          originalUrl,
          currentEpisodeIndex,
          totalEpisodes,
          detail?.type_name
        );
        return `${videoTitle || '影片标题'} - ${episodeText}`;
      })()}
		</div>`,
    },
           // 新增时间显示层
    {
      name: 'current-time-layer',
      html: `
        <div id="artplayer-current-time" style=" 
          position: absolute;
          top: 8px;
          right: 8px;
          font-size: 1rem;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 0 8px #000;
          pointer-events: none;
          z-index: 13;
          padding: 2px 5px;
          border-radius: 4px;
          background-color: rgba(0,0,0,0.3);
        "></div>
      `,
    },
  ],
  
        //-------新增标题-------------
        // HLS 支持配置
        customType: {
          m3u8: function (video: HTMLVideoElement, url: string) {
            if (!Hls) {
              console.error('HLS.js 未加载');
              return;
            }

              
            if (video.hls) {
              video.hls.destroy();
			  delete video.hls;
            }
            
            const hls = new Hls({
			
              debug: false, // 关闭日志
              enableWorker: true, // WebWorker 解码，降低主线程压力
              lowLatencyMode: true, // 开启低延迟 LL-HLS

              /* 缓冲/内存相关 */
              maxBufferLength: 50, // 向前缓存=这个值-backBufferLength，过大容易导致高延迟
              backBufferLength: 20, // 仅保留 20s 已播放内容，避免内存占用
              maxBufferSize: 60 * 1000 * 1000, // 约 60MB，超出后触发清理

			  maxMaxBufferLength: 55,//绝对的最大允许缓冲区长度

              /* 自定义loader */
              loader: blockAdEnabledRef.current
                ? CustomHlsJsLoader
                : Hls.DefaultConfig.loader,
            });

            hls.loadSource(url);
            hls.attachMedia(video);

            video.hls = hls;
            ensureVideoSource(video, url);

			  hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
			  levelSwitchCountRef.current++;
			  if (levelSwitchCountRef.current === 1) {
			    setTimeout(() => {
			      videoReadyRef.current = true;
				  console.log('第一次切换，延迟后状态',videoReadyRef.current);
			    }, 900);
			  }
			  // 如果是第二次及以后的切换
			  if (levelSwitchCountRef.current >= 2) {
				videoReadyRef.current = true;
				console.log('第二次切换，状态',videoReadyRef.current);
			  }
				
			  });
	
            hls.on(Hls.Events.ERROR, function (event: any, data: any) {
				// 无论是否致命错误，都尝试隐藏加载蒙层
				  setIsVideoLoading(false);

              console.error('HLS Error:', event, data);
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('网络错误，尝试恢复...');
					//hls 全局错误提示
				    if (typeof window !== 'undefined') {
				      window.dispatchEvent(
				        new CustomEvent('globalError', {
				          detail: { message: '网络错误，尝试恢复...'},
				        })
				      );
				    }
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('媒体错误，尝试恢复...');
					//hls 全局错误提示
				    if (typeof window !== 'undefined') {
				      window.dispatchEvent(
				        new CustomEvent('globalError', {
				          detail: { message: '视频错误，尝试恢复...'},
				        })
				      );
				    }
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('无法恢复的错误');
                    hls.destroy();
                    break;
                }
              }
            });
          },
        },
        icons: {
          loading:
            '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
        },
        settings: [
          {
            html: '去广告',
            icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
            tooltip: blockAdEnabled ? '已开启' : '已关闭',
            onClick() {
              const newVal = !blockAdEnabled;
              try {
                localStorage.setItem('enable_blockad', String(newVal));
                if (artPlayerRef.current) {
                  resumeTimeRef.current = artPlayerRef.current.currentTime;
                  if (
                    artPlayerRef.current.video &&
                    artPlayerRef.current.video.hls
                  ) {
                    artPlayerRef.current.video.hls.destroy();
                  }
                  artPlayerRef.current.destroy();
                  artPlayerRef.current = null;
                     
                }
                setBlockAdEnabled(newVal);
              } catch (_) {
                // ignore
              }
              return newVal ? '当前开启' : '当前关闭';
            },
          },
			  {
				name: '跳过片头片尾',
				html: '跳过片头片尾',
				switch: skipConfigRef.current.enable,
				onSwitch: function (item) {
				  const newConfig = {
					...skipConfigRef.current,
					enable: !item.switch,
				  };
				  handleSkipConfigChange(newConfig);
				  return !item.switch;
				},
			  },
			  {
				name: '设置片头',
				html: '设置片头',
				icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="#ffffff"/><path d="M9 12L17 12" stroke="#ffffff" stroke-width="2"/><path d="M17 6L17 18" stroke="#ffffff" stroke-width="2"/></svg>',
				tooltip:
				  skipConfigRef.current.intro_time === 0
					? '设置片头时间'
					: `${formatTime(skipConfigRef.current.intro_time)}(点击删除)`,
				onClick: function () {
				  const currentTime = artPlayerRef.current?.currentTime || 0;
				  const currentIntroTime = skipConfigRef.current.intro_time;

			    // 如果有设置，直接删除
			    if (currentIntroTime > 0) {
			        const newConfig = {
			          ...skipConfigRef.current,
			          intro_time: 0,
			        };
			        handleSkipConfigChange(newConfig);
			        artPlayerRef.current.notice.show = '已删除片头配置';
			        return '';
			    }
			    // 如果没有设置，直接使用当前时间设置
				  if (currentTime > 0) {
					const newConfig = {
					  ...skipConfigRef.current,
					  intro_time: currentTime,
					};
					handleSkipConfigChange(newConfig);
					return `${formatTime(currentTime)}(点击删除)`;
				  }
				},
			  },
			  {
				name: '设置片尾',
				html: '设置片尾',
				icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6L7 18" stroke="#ffffff" stroke-width="2"/><path d="M7 12L15 12" stroke="#ffffff" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="#ffffff"/></svg>',
		          tooltip:
		            skipConfigRef.current.outro_time >= 0
		              ? '设置片尾时间'
		              : `-${formatTime(-skipConfigRef.current.outro_time)}(点击删除)`,
				onClick: function () {
					const currentOutroTime = skipConfigRef.current.outro_time;
					    // 如果有设置，直接删除
				    if (currentOutroTime < 0) {
				        const newConfig = {
				          ...skipConfigRef.current,
				          outro_time: 0,
				        };
				        handleSkipConfigChange(newConfig);
				        artPlayerRef.current.notice.show = '已删除片尾配置';
				      return '';
				    }
				  const outroTime =
					-(
					  artPlayerRef.current?.duration -
					  artPlayerRef.current?.currentTime
					) || 0;
				  if (outroTime < 0) {
					const newConfig = {
					  ...skipConfigRef.current,
					  outro_time: outroTime,
					};
					handleSkipConfigChange(newConfig);
					return `-${formatTime(-skipConfigRef.current.outro_time)}(点击删除)`;
				  }
				},
			  },
			  {
				html: '删除跳过配置',
				icon: `
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
					xmlns="http://www.w3.org/2000/svg">
					<path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7" 
					stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
					<path d="M10 11V17" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
					<path d="M14 11V17" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
					<path d="M3 7H21" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
					<path d="M8 7V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V7" 
					stroke="white" stroke-width="2" fill="none"/>
				</svg>
				`,
				tooltip: '删除跳过配置',
				onClick: function () {
				  handleSkipConfigChange({
					enable: false,
					intro_time: 0,
					outro_time: 0,
				  });
				  return '';
				},
			  },
        ],
        // 控制栏配置
        controls: [
			  // 快退10秒按钮
  {
    position: 'left',
    index: 32,
    html: '<i class="art-icon flex art-control-custom-rewind"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg></i>',
    tooltip: '快退10秒',
    click: function () {
      if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
        artPlayerRef.current.currentTime = Math.max(artPlayerRef.current.currentTime - 10, 0);
        artPlayerRef.current.notice.show = '快退10秒';
      }
    },
  },
  // 快进10秒按钮
  {
    position: 'left',
    index: 33,
    html: '<i class="art-icon flex art-control-custom-forward"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg></i>',
    tooltip: '快进10秒',
    click: function () {
      if (artPlayerRef.current) {
        artPlayerRef.current.currentTime = Math.min(
          artPlayerRef.current.currentTime + 10,
          artPlayerRef.current.duration || artPlayerRef.current.currentTime + 10
        );
        artPlayerRef.current.notice.show = '快进10秒';
      }
    },
  },
          {
            position: 'left',
            index: 13,
            html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
            tooltip: '播放下一集',
            click: function () {
              handleNextEpisode();
            },
          },
        ],
      });
      
      // 监听播放器事件
      artPlayerRef.current.on('ready', () => {
        setError(null);
       	isChangingEpisodeRef.current = false;

      });
   
              
      artPlayerRef.current.on('video:volumechange', () => {
        lastVolumeRef.current = artPlayerRef.current.volume;
      });
      artPlayerRef.current.on('video:ratechange', () => {
        lastPlaybackRateRef.current = artPlayerRef.current.playbackRate;
      });
		
      // 监听视频可播放事件，这时恢复播放进度更可靠
      artPlayerRef.current.on('video:canplay', () => {
  console.log('播放器canplay，当前开始创建缓冲区-状态:', videoReadyRef.current);
  isChangingEpisodeRef.current = false;
  
  // 隐藏加载状态，显示播放器
  setIsVideoLoading(false);

  const resumeTime = resumeTimeRef.current;
  const skipEnabled = skipConfigRef.current.enable;
	//如果已经跳过开头或者恢复进度，停止跳过，避免用户想回看片头，又跳过开头
	if (skipIntroProcessedRef.current) {
		return;
	}
		
  // 情况1：跳过开关没开启并且没有恢复进度存在
  if (!skipEnabled && resumeTime === 0) {
    return;
  }
  
  // ============ 新增：使用setInterval检查质量状态 ============
  if (!videoReadyRef.current) {
    console.log('视频质量未稳定，等待质量切换完成...');
    
    // 设置检查间隔
    let checkCount = 0;
    const maxChecks = 14; // 最多检查50次（5秒）
    const checkInterval = 100; // 每100ms检查一次
    
    const intervalId = setInterval(() => {
      checkCount++;
      
      // 如果质量已准备好
      if (videoReadyRef.current) {
        console.log(`第${checkCount}次检查：质量已稳定`);
        clearInterval(intervalId);
        executeProgressRestoration();
		videoReadyRef.current = false;
        return;
      }
      
      // 如果超过最大检查次数
      if (checkCount >= maxChecks) {
        console.warn(`超过${maxChecks}次检查，强制恢复`);
        clearInterval(intervalId);
        executeProgressRestoration();
		videoReadyRef.current = false;
        return;
      }
    }, checkInterval);
    
    // 设置超时强制清除
    setTimeout(() => {
      clearInterval(intervalId);
    }, maxChecks * checkInterval);
    
    return;
  }
  
  // 如果质量已经准备好，直接执行恢复逻辑
  executeProgressRestoration();
  videoReadyRef.current = false;
  // ============ 恢复进度函数 ============
  function executeProgressRestoration() {
    const currentTime = artPlayerRef.current.currentTime || 0;
    const duration = artPlayerRef.current.duration || 0;
    let resumeTime = resumeTimeRef.current;
    const skipEnabled = skipConfigRef.current.enable;
    const introTime = skipConfigRef.current.intro_time;
						//如果恢复进度末尾的前2秒内，调整往前5秒，避免太靠后
            if (duration && resumeTime >= duration - 2) {
              resumeTime = Math.max(0, duration - 5);
            }
	  
    // ============= 处理跳过片头逻辑 =============

    // 情况2：恢复进度存在，跳过开启
    if (duration > 0 && resumeTime > 0 && introTime > 0) {
      const targetTime = Math.max(resumeTime, introTime);
      if (currentTime < targetTime) {
        artPlayerRef.current.currentTime = targetTime;
        console.log('成功恢复播放进度到:', targetTime);
        
        artPlayerRef.current.notice.show = targetTime === resumeTime 
          ? `已恢复进度 (${formatTime(resumeTime)})` 
          : `已跳过片头 (${formatTime(introTime)})`;
        resumeTimeRef.current = 0;
		skipIntroProcessedRef.current = true;//表示已经恢复进度或跳过开头
        return;
      }
    }

    // 情况3：只有恢复进度
    if (duration > 0 && resumeTime > 0) {
      if (currentTime < resumeTime) {
        artPlayerRef.current.currentTime = resumeTime;
        console.log('恢复播放进度:', resumeTime);
        
        artPlayerRef.current.notice.show = `恢复播放进度 (${formatTime(resumeTime)})`;
        resumeTimeRef.current = 0;
		skipIntroProcessedRef.current = true;//表示已经恢复进度或跳过开头
        return;
      }
    }

    // 情况4：只有跳过片头
    if (duration > 0 && introTime > 0) {
      if (currentTime < introTime) {
        artPlayerRef.current.currentTime = introTime;
        console.log('跳过片头:', introTime);

        artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(introTime)})`;
		skipIntroProcessedRef.current = true;//表示已经恢复进度或跳过开头
        return;
      }
    }
  }
		/*
	    isChangingEpisodeRef.current = false;
		  // 隐藏加载状态，显示播放器
        setIsVideoLoading(false);

		  const currentTime = artPlayerRef.current.currentTime || 0;
		  const duration = artPlayerRef.current.duration || 0;

		  const resumeTime = resumeTimeRef.current;
		  const skipEnabled = skipConfigRef.current.enable;
		  const introTime = skipConfigRef.current.intro_time;
		
		  // 情况1：跳过开关没开启并且没有恢复进度存在
		  if (!skipEnabled && resumeTime === 0) {
		    return;
		  }
		if (!videoReadyRef.current){
			return;
		}
		  // ============= 处理跳过片头逻辑 =============

		    // 情况2：恢复进度存在，跳过开启
		    if (duration > 0 && resumeTime > 0 && introTime > 0) {
		      const targetTime = Math.max(resumeTime, introTime);
		      if (currentTime < targetTime) {

		        artPlayerRef.current.currentTime = targetTime;
				console.log('成功恢复播放进度到:', targetTime);
				  
		        artPlayerRef.current.notice.show = targetTime === resumeTime 
		          ? `已恢复进度 (${formatTime(resumeTime)})` 
		          : `已跳过片头 (${formatTime(introTime)})`;
		        resumeTimeRef.current = 0;
		        return;
		      }
		    }
		
		    // 情况3：只有恢复进度
		    if (duration > 0 && resumeTime > 0) {
		      if (currentTime < resumeTime) {
		        artPlayerRef.current.currentTime = resumeTime;
				console.log('恢复播放进度:', resumeTime);
				  
		        artPlayerRef.current.notice.show = `已恢复播放进度 (${formatTime(resumeTime)})`;
		        resumeTimeRef.current = 0;
		        return;
		      }
		    }
		
		    // 情况4：只有跳过片头
		    if (duration > 0 && introTime > 0) {
		      if (currentTime < introTime) {
		        artPlayerRef.current.currentTime = introTime;
				console.log('跳过片头:', introTime);

		        artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(introTime)})`;
		        return;
		      }
		    }------------------*/
	       
		  // ============= 处理跳过结尾逻辑 由于要实时监测，放在timeupdate=============


        setTimeout(() => {
          if (
            Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) > 0.01
          ) {
            artPlayerRef.current.volume = lastVolumeRef.current;
          }
          if (
            Math.abs(
              artPlayerRef.current.playbackRate - lastPlaybackRateRef.current
            ) > 0.01 &&
            isWebkit
          ) {
            artPlayerRef.current.playbackRate = lastPlaybackRateRef.current;
          }
        }, 0);

      });
		
      // 监听视频时间更新事件，实现跳过片头片尾
      artPlayerRef.current.on('video:timeupdate', () => {
		  const currentTime = artPlayerRef.current.currentTime || 0;
		  const duration = artPlayerRef.current.duration || 0;
		  const skipEnabled = skipConfigRef.current.enable;
		  const outroTime = skipConfigRef.current.outro_time; // 负值，如 -60
		  //如果没开启跳过开关，或者没有片尾配置（负数）
		  if (!skipEnabled || outroTime >= 0) {
		    return;
		  }
		
		  /*
		  const resumeTime = resumeTimeRef.current;
		  const skipEnabled = skipConfigRef.current.enable;
		  const introTime = skipConfigRef.current.intro_time;
		  // 情况1：跳过开关没开启并且没有恢复进度存在
		  if (!skipEnabled && resumeTime === 0) {
		    return;
		  }
		
		  // ============= 处理跳过片头逻辑（只执行一次） =============
		  
		  // 使用一个局部变量记录是否处理过开头
		  if (!skipIntroProcessedRef.current) {
		    // 情况2：恢复进度存在，跳过开启
		    if (duration > 0 && resumeTime > 0 && introTime > 0) {
		      const targetTime = Math.max(resumeTime, introTime);
		      if (currentTime < targetTime) {

		        artPlayerRef.current.currentTime = targetTime;
				console.log('成功恢复播放进度到:', targetTime);
				  
		        artPlayerRef.current.notice.show = targetTime === resumeTime 
		          ? `已恢复进度 (${formatTime(resumeTime)})` 
		          : `已跳过片头 (${formatTime(introTime)})`;
		        resumeTimeRef.current = 0;
		        skipIntroProcessedRef.current = true;
		        return;
		      }
		    }
		
		    // 情况3：只有恢复进度
		    if (duration > 0 && resumeTime > 0) {
		      if (currentTime < resumeTime) {
		        artPlayerRef.current.currentTime = resumeTime;
				console.log('恢复播放进度:', resumeTime);
				  
		        artPlayerRef.current.notice.show = `已恢复播放进度 (${formatTime(resumeTime)})`;
		        resumeTimeRef.current = 0;
		        skipIntroProcessedRef.current = true;
		        return;
		      }
		    }
		
		    // 情况4：只有跳过片头
		    if (duration > 0 && introTime > 0) {
		      if (currentTime < introTime) {
		        artPlayerRef.current.currentTime = introTime;
				console.log('跳过片头:', introTime);

		        artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(introTime)})`;
		        skipIntroProcessedRef.current = true;
		        return;
		      }
		    }
		
		    // 如果当前时间已经超过可能的目标时间，标记为已处理
		    const maxPossibleTime = Math.max(
		      resumeTime,
		      introTime
		    );
		    if (currentTime >= maxPossibleTime) {
		      skipIntroProcessedRef.current = true;
		    }
		  }*/
		
		  // ============= 处理跳过结尾逻辑（延迟检查） =============
		    // 计算片尾开始时间（负值变正）
		    const outroStartTime = duration + outroTime; // outroTime是负值，如 -60 → 300-60=240
		    
		    // 优化：只有接近片尾开始时间（例如提前3秒）才开始检查
		    // 避免整个视频都在检查片尾
		    const checkStartTime = outroStartTime - 5; // 提前5秒开始检查
		    
		    // 如果还没到检查时间，直接返回
		    if (currentTime < checkStartTime) {
		      return;
		    }
		  
		  // 跳过片尾：只有跳过开关开启且设置了片尾时间
		  if (outroTime < 0 && duration > 0) {	  
		    // 现在才真正检查是否进入片尾区域
		    if (currentTime > outroStartTime) {
		      if (
		        currentEpisodeIndexRef.current <
		        (detailRef.current?.episodes?.length || 1) - 1
		      ) {
		        handleNextEpisode();
		      } else {
		        artPlayerRef.current.pause();
		      }
		      artPlayerRef.current.notice.show = `已跳过片尾`;
		    }
		  }
      });

      artPlayerRef.current.on('error', (err: any) => {
        console.error('播放器错误:', err);
        if (artPlayerRef.current.currentTime > 0) {
          return;
        }
      });

      // 监听视频播放结束事件，自动播放下一集
      artPlayerRef.current.on('video:ended', () => {
        const d = detailRef.current;
        const idx = currentEpisodeIndexRef.current;
        if (d && d.episodes && idx < d.episodes.length - 1) {
          setTimeout(() => {
            setCurrentEpisodeIndex(idx + 1);
          }, 1000);
        }
      });

      /*artPlayerRef.current.on('video:timeupdate', () => {
        const now = Date.now();
        let interval = 5000;
        if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'd1') {
          interval = 10000;
        }
        if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
          interval = 20000;
        }
        if (now - lastSaveTimeRef.current > interval) {
          saveCurrentPlayProgress();
		  console.log('d1-10s,upatash-20s,其他-5s，定时保存---播放进度已保存');
          lastSaveTimeRef.current = now;
        }
      });*/

      artPlayerRef.current.on('pause', () => {
		  if (!isChangingEpisodeRef.current) {
		    saveCurrentPlayProgress();
		    console.log('暂停---播放进度已保存');
		  }
      });

	  if (artPlayerRef.current?.video) {
		  const { videoUrl: realVideoUrl } = parseEpisodeUrl(videoUrl);
		  ensureVideoSource(
			artPlayerRef.current.video as HTMLVideoElement,
			realVideoUrl
		  );
		}
    } catch (err) {
      console.error('创建播放器失败:', err);
      setError('播放器初始化失败');
    }
  }, [Artplayer, Hls, videoUrl, loading, blockAdEnabled, playRecordLoaded]);

  //-------新增：时间显示----------------
  // 添加时间更新函数和事件监听
      useEffect(() => {
  if (!artPlayerRef.current)  return;
 
  // 更新时间显示 
  const updateCurrentTime = () => {
    const timeElement = document.getElementById('artplayer-current-time'); 
    if (timeElement) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2,  '0');
      const minutes = now.getMinutes().toString().padStart(2,  '0');
      timeElement.textContent  = `${hours}:${minutes}`;
    }
  };
 
  // 初始更新 
  updateCurrentTime();
  
  // 每分钟更新一次 
  const timer = setInterval(updateCurrentTime, 60000);

        //新增-----------监听控制栏显示/隐藏事件来同步时间，标题显示-----------
         
   	  const titleElement = document.getElementById('artplayer-title-layer');
      const timeElement = document.getElementById('artplayer-current-time');
	    if (titleElement && timeElement){
		// 初始隐藏标题
		titleElement.style.display  = 'none';
		 }
		let isFullscreen = false;
		let fullscreenWeb = false;
	  // ========== 新增：记录控制栏当前状态 ==========
	    let isControlBarVisible = true;
		// 监听全屏切换事件fullscreen
		artPlayerRef.current.on('fullscreen',  (status: boolean) => {
		isFullscreen = status;
		isControlBarVisible = status;
		// 全屏退出时强制隐藏标题
		if (!status && titleElement) {
			  titleElement.style.display  = 'none';
			}
		});
		artPlayerRef.current.on('fullscreenWeb',  (status: boolean) => {
		fullscreenWeb = status;
	    isControlBarVisible = status;
		// 全屏退出时强制隐藏标题
			if (!status && titleElement) {
			  titleElement.style.display  = 'none';
			}
		});
 

        artPlayerRef.current.on('control',  (show: boolean) => {
		if (isFullscreen || fullscreenWeb) {
        if (timeElement && titleElement) {
       if (show && !isControlBarVisible) {
	          // 请求显示，且当前是隐藏状态 → 显示
	          timeElement.style.display = 'block';
	          titleElement.style.display = 'block';
	          isControlBarVisible = true;
	          console.log('显示控制栏');
	          
	        } else if (!show && isControlBarVisible) {
	          // 请求隐藏，且当前是显示状态 → 隐藏
	          timeElement.style.display = 'none';
	          titleElement.style.display = 'none';
	          isControlBarVisible = false;
	          console.log('隐藏控制栏');
	        }
        }
		}
    });


 
return () => {
  clearInterval(timer);
  if (artPlayerRef.current)  {
    // 组件卸载时移除事件监听 
	artPlayerRef.current.off('fullscreen'); 
	artPlayerRef.current.off('fullscreenWeb'); 
    artPlayerRef.current.off('control');
  }
};
        
}, [artPlayerRef.current]);

  //-------新增：时间显示----------------
    
    //--------------切换集数、加载新视频时调用---------------------
  function updateTitleLayer(videoTitle: string, currentEpisodeIndex: number,videoUrl: string) {
    const titleLayer = document.getElementById('artplayer-title-layer'); 
    if (titleLayer) {
	const originalUrl = detail?.episodes[currentEpisodeIndex] || '';
    const episodeText = extractEpisodeTitle(
      originalUrl,
      currentEpisodeIndex,
      detail?.episodes?.length || 0,
      detail?.type_name
    );
    titleLayer.innerText = `${videoTitle} - ${episodeText}`;
    }
}
  useEffect(() => {
    if (artPlayerRef.current && videoTitle) {
        updateTitleLayer(videoTitle, currentEpisodeIndex,videoUrl);
    }
}, [videoTitle, currentEpisodeIndex,videoUrl]);
    
    //--------------切换集数、加载新视频时调用---------------------


  // 当组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);


  if (loading) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 动画影院图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>
                  {loadingStage === 'searching' && '🔍'}
                  {loadingStage === 'preferring' && '⚡'}
                  {loadingStage === 'fetching' && '🎬'}
                  {loadingStage === 'ready' && '✨'}
                </div>
                {/* 旋转光环 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
              </div>

              {/* 浮动粒子效果 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 进度指示器 */}
            <div className='mb-6 w-80 mx-auto'>
              <div className='flex justify-center space-x-2 mb-4'>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'searching' || loadingStage === 'fetching'
                      ? 'bg-green-500 scale-125'
                      : loadingStage === 'preferring' ||
                        loadingStage === 'ready'
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'preferring'
                      ? 'bg-green-500 scale-125'
                      : loadingStage === 'ready'
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'ready'
                      ? 'bg-green-500 scale-125'
                      : 'bg-gray-300'
                  }`}
                ></div>
              </div>

              {/* 进度条 */}
              <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out'
                  style={{
                    width:
                          loadingStage === 'searching' ||
                          loadingStage === 'fetching'
                        ? '33%'
                        : loadingStage === 'preferring'
                        ? '66%'
                        : '100%',
                  }}
                ></div>
              </div>
            </div>

            {/* 加载消息 */}
            <div className='space-y-2'>
              <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
                {loadingMessage}
              </p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 错误图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>😵</div>
                {/* 脉冲效果 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-20 animate-pulse'></div>
              </div>

              {/* 浮动错误粒子 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-red-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-yellow-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 错误信息 */}
            <div className='space-y-4 mb-8'>
              <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
                哎呀，出现了一些问题
              </h2>
              <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
                <p className='text-red-600 dark:text-red-400 font-medium'>
                  {error}
                </p>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                请检查网络连接或尝试刷新页面
              </p>
            </div>

            {/* 操作按钮 */}
            <div className='space-y-3'>
              <button
                onClick={() =>
                  videoTitle
                    ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
                    : router.back()
                }
                className='w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl'
              >
                {videoTitle ? '🔍 返回搜索' : '← 返回上页'}
              </button>

              <button
                onClick={() => window.location.reload()}
                className='w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200'
              >
                🔄 重新尝试
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play'>
      <div className='flex flex-col gap-1 py-4 px-5 lg:px-[3rem] 2xl:px-20'>
        {/* 第一行：影片标题 */}
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
            {videoTitle || '影片标题'}
            {totalEpisodes > 1 && (
              <span className='text-gray-500 dark:text-gray-400'>
                {/* 显示当前集的名称 */}
		        {` > ${(() => {
		          const originalUrl = detail?.episodes[currentEpisodeIndex] || '';
		          return extractEpisodeTitle(
		            originalUrl, 
		            currentEpisodeIndex, 
		            totalEpisodes,
		            detail?.type_name
		          );
		        })()}`}
              </span>
            )}
          </h1>
        </div>
        
        {/* 第二行：播放器和选集 */}
        <div className='space-y-2'>
          {/* 折叠控制 - 仅在 lg 及以上屏幕显示 */}
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() =>
                setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
              }
              className='group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
              title={
                isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                  isEpisodeSelectorCollapsed ? 'rotate-180' : 'rotate-0'
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isEpisodeSelectorCollapsed ? '显示' : '隐藏'}
              </span>

              {/* 精致的状态指示点 */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${
                  isEpisodeSelectorCollapsed
                    ? 'bg-orange-400 animate-pulse'
                    : 'bg-green-400'
                }`}
              ></div>
            </button>
          </div>

          <div
            className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${
              isEpisodeSelectorCollapsed
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-4'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`h-full transition-all duration-300 ease-in-out rounded-xl border border-white/0 dark:border-white/30 ${
                isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'
              }`}
            >
              <div className='relative w-full h-[300px] lg:h-full'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg'
                 
                      onDoubleClick={isMobile() ? undefined : (e) => {/*PC原双击逻辑*/}}
                      onTouchEnd={(e) => {
                        // 移动端双击识别
                        if (!isMobile()) return;
                        // 简单双击识别（如需更精准可用第三方库）
                        const now = Date.now();
                        if (
                          (window as any)._lastTouch &&
                          now - (window as any)._lastTouch < 400
                        ) {
                          handleMobileDoubleTap(e);
                          (window as any)._lastTouch = 0;
                          e.preventDefault();
                        } else {
                          (window as any)._lastTouch = now;
                        }
                      }}
                  
                ></div>

                {/* 换源加载蒙层 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[500] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      {/* 动画影院图标 */}
                      <div className='relative mb-8'>
                        <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                          <div className='text-white text-4xl'>🎬</div>
                          {/* 旋转光环 */}
                          <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                        </div>

                        {/* 浮动粒子效果 */}
                        <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                          <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                          <div
                            className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                            style={{ animationDelay: '0.5s' }}
                          ></div>
                          <div
                            className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                            style={{ animationDelay: '1s' }}
                          ></div>
                        </div>
                      </div>

                      {/* 换源消息 */}
                      <div className='space-y-2'>
                        <p className='text-xl font-semibold text-white animate-pulse'>
                          {videoLoadingStage === 'sourceChanging'
                            ? '🔄 切换播放源...'
                            : '🔄 视频加载中...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 选集和换源 - 在移动端始终显示，在 lg 及以上可折叠 */}
            <div
              className={`h-[300px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${
                isEpisodeSelectorCollapsed
                  ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
                  : 'md:col-span-1 lg:opacity-100 lg:scale-100'
              }`}
            >
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                value={currentEpisodeIndex + 1}
                onChange={handleEpisodeChange}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
              />
            </div>
          </div>
        </div>

        <div>
          <span className="text-gray-500 dark:text-gray-400">快捷键说明：1.电脑端：上下键=音量+/-，左右键=快退/进10秒，空格=播放/暂停，F键=切换全屏，Alt+左箭头=上一集，Alt+右箭头=下一集<br />
2.移动端：屏幕双击-&gt;左右侧=快退/进10秒，中间=播放/暂停
          </span>
          </div>
        {/* 详情展示 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          {/* 文字区 */}
          <div className='md:col-span-3'>
            <div className='p-6 flex flex-col min-h-0'>
              {/* 标题 */}
              <h1 className='text-3xl font-bold mb-2 tracking-wide flex items-center flex-shrink-0 text-center md:text-left w-full'>
                {videoTitle || '影片标题'}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite();
                  }}
                  className='ml-3 flex-shrink-0 hover:opacity-80 transition-opacity'
                >
                  <FavoriteIcon filled={favorited} />
                </button>
              </h1>

              {/* 关键信息行 */}
              <div className='flex flex-wrap items-center gap-3 text-base mb-4 opacity-80 flex-shrink-0'>
                {detail?.class && (
                  <span className='text-green-600 font-semibold'>
                    {detail.class}
                  </span>
                )}
                {(detail?.year || videoYear) && (
                  <span>{detail?.year || videoYear}</span>
                )}
                {detail?.source_name && (
                  <span className='border border-gray-500/60 px-2 py-[1px] rounded'>
                    {detail.source_name}
                  </span>
                )}
                {detail?.type_name && <span>{detail.type_name}</span>}
              </div>
              {/* 剧情简介 */}
              {detail?.desc && (
                <div
                  className='mt-0 text-base leading-relaxed opacity-90 overflow-y-auto pr-2 flex-1 min-h-0 scrollbar-hide'
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {detail.desc}
                </div>
              )}
            </div>
          </div>

          {/* 封面展示 */}
          <div className='hidden md:block md:col-span-1 md:order-first'>
            <div className='pl-0 py-4 pr-6'>
              <div className='bg-gray-300 dark:bg-gray-700 aspect-[2/3] flex items-center justify-center rounded-xl overflow-hidden'>
                {videoCover ? (
                  <img
                    src={processImageUrl(videoCover)}
                    alt={videoTitle}
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <span className='text-gray-600 dark:text-gray-400'>
                    封面图片
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

// FavoriteIcon 组件
const FavoriteIcon = ({ filled }: { filled: boolean }) => {
  if (filled) {
    return (
      <svg
        className='h-7 w-7'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
          fill='#ef4444' /* Tailwind red-500 */
          stroke='#ef4444'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }
  return (
    <Heart className='h-7 w-7 stroke-[1] text-gray-600 dark:text-gray-300' />
  );
};

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}
