/* eslint-disable no-console */
'use client';
import { RefreshCw } from 'lucide-react';//导入图标组件
import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import { fetchVideoDetail } from '@/lib/fetchVideoDetail';
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
  savePlayRecord,// 关键：用此方法更新数据库
} from '@/lib/db.client';

import ScrollableRow from '@/components/ScrollableRow';
import VideoCard from '@/components/VideoCard';

interface ContinueWatchingProps {
  className?: string;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 区分初始加载与刷新
  //const [newEpisodeFlags, setNewEpisodeFlags] = useState<Record<string, boolean>>({});

  // 处理播放记录数据更新的函数
  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    // 将记录转换为数组并根据 save_time 由近到远排序
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    // 按 save_time 降序排序（最新的在前面）
    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time
    );

    setPlayRecords(sortedRecords);
	// 初始化 flags
    /*const flags: Record<string, boolean> = {};
    sortedRecords.forEach(({  key }) => {
      flags[key] = false;
    });
    setNewEpisodeFlags(flags);
	*/
  };
  
  
   useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);

        // 从缓存或API获取所有播放记录
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();
	  

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      }
    );

    return unsubscribe;
  }, []);

//------新增更新总集数-----------
// 检查所有视频是否更新了剧集
  const handleUpdateAllEpisodes = async () => {
    if (refreshing || playRecords.length  === 0) return;
 
    setRefreshing(true);
    //const updatedFlags: Record<string, boolean> = { ...newEpisodeFlags };
 
    try {
      // 并发限制：最多同时请求 5 个
      const BATCH_SIZE = 5;
      for (let i = 0; i < playRecords.length;  i += BATCH_SIZE) {
        const batch = playRecords.slice(i,  i + BATCH_SIZE);
        await Promise.all( 
          batch.map(async  (record) => {
			   
            const { key, total_episodes } = record;
			const { source, id } = parseKey(key);
            try {
              const videoDetail = await fetchVideoDetail({ source, id });
              if (!videoDetail?.episodes) return;
 
              const newTotal = videoDetail.episodes.length; 
              if (newTotal > total_episodes) {
                // 更新本地记录
                await savePlayRecord(source, id, {
                  ...record,
                  total_episodes: newTotal,
                  save_time: Date.now(), 
                });
                //updatedFlags[key] = true;
				fetchPlayRecords();//再次加载一次新的播放记录
              }
            } catch (err) {
              console.warn(` 获取视频 ${source}-${id} 详情失败`, err);
            }
          })
        );
      }
 
      //setNewEpisodeFlags(updatedFlags);
    } catch (error) {
      console.error(' 批量更新剧集失败:', error);
    } finally {
      setRefreshing(false);
    }
  };
//------新增更新总集数-----------

  // 如果没有播放记录，则不渲染组件
  if (!loading && playRecords.length === 0) {
    return null;
  }

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };
  


  return (
    <section className={`mb-8 ${className || ''}`}>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
          继续观看
        </h2>
		 <button
      onClick={handleUpdateAllEpisodes}
      disabled={refreshing}
      className="flex gap-1 px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label="检查剧集更新"
    >
      {refreshing ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      <span>{refreshing ? '检查中...' : '检查更新'}</span>
    </button>
        {!loading && playRecords.length > 0 && (
          <button
            className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            onClick={async () => {
              await clearAllPlayRecords();
              setPlayRecords([]);
            }}
          >
            清空
          </button>
        )}
      </div>
      <ScrollableRow>
        {loading
          ? // 加载状态显示灰色占位数据
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
              >
                <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                  <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                </div>
                <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
                <div className='mt-1 h-3 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
              </div>
            ))
          : // 显示真实数据
            playRecords.map((record) => {
              const { source, id } = parseKey(record.key);
              return (
                <div
                  key={record.key}
                  className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                >
                  <VideoCard
                    id={id}
                    title={record.title}
                    poster={record.cover}
                    year={record.year}
                    source={source}
                    source_name={record.source_name}
                    progress={getProgress(record)}
                    episodes={record.total_episodes}
					// 👇 新增字段：是否为新增集数（用于红点）
					//hasNewEpisode={!!newEpisodeFlags[record.key]}
                    currentEpisode={record.index}
                    query={record.search_title}
                    from='playrecord'
                    onDelete={() =>
                      setPlayRecords((prev) =>
                        prev.filter((r) => r.key !== record.key)
                      )
                    }
                    type={record.total_episodes > 1 ? 'tv' : ''}
                  />
                </div>
              );
            })}
      </ScrollableRow>
    </section>
  );
}
