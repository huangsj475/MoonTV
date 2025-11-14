/* eslint-disable no-console */
'use client';
import { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';

import type { PlayRecord } from '@/lib/db.client';
import { fetchVideoDetail } from '@/lib/fetchVideoDetail';
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
  savePlayRecord,
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
  const [allDataReady, setAllDataReady] = useState(false);//新增：播放记录准备就绪状态
  const hasShownReady = useRef(false);//新增：显示准备就绪信息，确保只显示一次

  // 新增：检查所有记录的数据就绪状态
  const checkAllDataReady = useCallback((records: (PlayRecord & { key: string })[]) => {
    return records.length > 0 && records.every(record => {
      const [source, id] = record.key.split('+');
      return source && id && record.title && record.cover;
    });
  }, []);
    // 新增：显示就绪提示
  const showReadyMessage = useCallback((count: number) => {
    if (!hasShownReady.current) {
      hasShownReady.current = true;
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { 
            message: `${count}个视频加载完成`
          },
        })
      );
    }
  }, []);
  
  // 处理播放记录数据更新的函数
  const updatePlayRecords = useCallback((allRecords: Record<string, PlayRecord>) => {
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
	
    // 新增：检查数据就绪状态
    if (checkAllDataReady(sortedRecords)) {
      setAllDataReady(true);
      showReadyMessage(sortedRecords.length);
    }
  }, [checkAllDataReady, showReadyMessage]);

  

   useEffect(() => {
	const fetchPlayRecords = async () => {

      try {
        setLoading(true);
        setAllDataReady(false);
        hasShownReady.current = false;

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

    console.log('加载播放记录。。。');
    fetchPlayRecords();

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      }
    );

    return unsubscribe;
  }, [updatePlayRecords]);// 新增：updatePlayRecords依赖
  
  //------新增更新单个视频剧集--------
const handleUpdateSingleEpisode = async (record: PlayRecord & { key: string }) => {
  const { key, title, total_episodes: oldTotal } = record;
  const { source, id } = parseKey(key);

  // 如果已经在批量更新中，则不允许单独更新
  if (refreshing) {
    Swal.fire({ 
      title: '请稍候',
      text: '当前正在批量更新中，请勿重复操作',
      icon: 'info'
    });
    return;
  }

  console.log(`[单独更新] 开始更新 ${source}+${id} "${title}"`);

  setRefreshing(true);

  try {
    // 显示加载中弹窗
    const progressSwal = Swal.fire({
      title: '正在检查更新',
      html: `正在检查 <strong>${title}</strong> 的剧集信息...`,
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading();
      }
    });

    // 获取视频详情
    const detailResponse = await fetch(`/api/detail?source=${source}&id=${id}`);
    
    if (!detailResponse.ok) {
      throw new Error('获取视频详情失败');
    }

    const videoDetail = await detailResponse.json();
    
    if (!videoDetail || !Array.isArray(videoDetail.episodes)) {
      throw new Error('获取到的数据格式不正确');
    }

    const newTotal = videoDetail.episodes.length;
    console.log(`[单独更新 - ${source}+${id}] 集数对比: 原 ${oldTotal} → 新 ${newTotal}`);

    // 关闭进度弹窗
    await Swal.close();

    if (newTotal > oldTotal) {
      // 更新数据库中的记录
      await savePlayRecord(source, id, {
        ...record,
        total_episodes: newTotal,
        save_time: Date.now(),
      });

      // 显示成功消息
      await Swal.fire({
        title: '发现新剧集！',
        html: `
          <div style="text-align: left;">
            <p><strong>${title}</strong></p>
            <p>集数更新: ${oldTotal} → ${newTotal}</p>
          </div>
        `,
        icon: 'success',
        confirmButtonText: '确认'
      });

      console.log(`[单独更新 - ${source}+${id}] 更新成功`);
    } else {
      await Swal.fire({
        title: '已是最新',
        html: `
          <div style="text-align: left;">
            <p><strong>${title}</strong></p>
            <p>当前已是最新版本，未发现新增集数。</p>
          </div>
        `,
        icon: 'info',
        confirmButtonText: '确认'
      });
    }
  } catch (error) {
    console.error(`[单独更新 - ${source}+${id}] 更新失败:`, error);
    
    await Swal.fire({
      title: '更新失败',
      text: error instanceof Error ? error.message : '未知错误',
      icon: 'error',
      confirmButtonText: '确认'
    });
  } finally {
    setRefreshing(false);
  }
};
  //------新增更新单个视频剧集--------

//------新增更新总集数-----------
// 检查所有视频是否更新了剧集
  const handleUpdateAllEpisodes = async () => {
  console.log('[  更新剧集] 按钮已点击,开始执行...');
 
  if (refreshing || playRecords.length  === 0) {
    if (refreshing) {
		Swal.fire({ 
        title: '请稍候',
        text: '当前正在更新中，请勿重复操作',
        icon: 'info'
      });
      console.log('[  更新剧集] 当前正在刷新中,跳过本次请求');
    } else if (playRecords.length  === 0) {
      Swal.fire({ 
        title: '无播放记录',
        text: '当前没有播放记录，无需更新。',
        icon: 'info',
        confirmButtonText: '确认'
      });
    }
    return;
  }
 
  setRefreshing(true);
  const BATCH_SIZE = 2;
  let hasChanges = false;
  const updateMessages: string[] = []; // 存储更新信息用于展示
   // 显示进度弹窗 
  const progressSwal = Swal.fire({ 
    title: '正在更新剧集',
      html: `
        <div style="text-align: left;">
          <div id="batch-progress">
            <p>准备开始更新...</p>
          </div>
          <p style="margin-top: 10px; color: #666;">
            共 ${playRecords.length} 个剧集
          </p>
        </div>
      `,
    allowOutsideClick: false,
    showConfirmButton: false,
    willOpen: () => {
      Swal.showLoading(); 
    }
  });
  try {
    console.log(`[  更新剧集] 共有 ${playRecords.length}  条播放记录,将分批处理`);
 
    for (let i = 0; i < playRecords.length;  i += BATCH_SIZE) {
      const batch = playRecords.slice(i,  i + BATCH_SIZE);
      console.log(`[  更新剧集] 正在处理第 ${Math.floor(i  / BATCH_SIZE) + 1} 批次,包含 ${batch.length}  个视频`);
      // 显示当前批次所有任务
	 const batchProgressHTML = `
        <div style="text-align: left;">
		  <p style="margin-top: 10px; color: #666;">
            正在检查剧集 (${Math.min(i + BATCH_SIZE, playRecords.length)}/${playRecords.length})
          </p>
          <div id="batch-progress">
            ${batch.map((record, idx) => 
              `<p>🔄 ${i + idx + 1}/${playRecords.length}: ${record.title}</p>`
            ).join('')}
          </div>
        </div>
      `;
	    Swal.update({
        html: batchProgressHTML
      });
		
      await Promise.all( 
        batch.map(async  (record) => {
          const { key, total_episodes: oldTotal, title } = record;
          const { source, id } = parseKey(key);
 
          console.log(`[  更新剧集 - ${source}+${id}] 开始检查 "${title}" 的最新信息`);
 
          try {
			  // 1. 发起请求并验证响应状态
            //const videoDetail = await fetchVideoDetail({ source, id });
			const detailResponse = await fetch(`/api/detail?source=${source}&id=${id}`);
            
				  if (!detailResponse.ok)  {
					throw new Error('获取视频详情失败');
				  }
				 
				  // 2. 解析JSON数据 
				  const videoDetail = await detailResponse.json(); 
				  console.log(`[ 更新剧集 - ${source}+${id}] 获取详情成功`, videoDetail);
				 
				  // 3. 数据验证（三重保障）
				  if (!videoDetail || !Array.isArray(videoDetail.episodes))  {
					console.warn(`[${source}+${id}]  episodes数据异常`, {
					  received: videoDetail?.episodes,
					  expected: "非空数组"
					});
					return;
				  }
           
            const newTotal = videoDetail.episodes.length; 
            console.log(`[  更新剧集 - ${source}+${id}] 集数对比: 原 ${oldTotal} → 新 ${newTotal}`);
 
            if (newTotal > oldTotal) {
              console.log(`[  更新剧集 - ${source}+${id}] 发现新集! 正在保存...`);
 
              // ✅ 2. 将新的总集数保存到数据库
              await savePlayRecord(source, id, {
                ...record,
                total_episodes: newTotal,
                save_time: Date.now(), 
              });
 
              // 记录更新信息
              updateMessages.push(`${title}:  ${oldTotal} → ${newTotal}`);
			  
              hasChanges = true;
            } else {
              console.log(`[  更新剧集 - ${source}+${id}] 无新增集数,跳过`);
            }
          } catch (err) {
            console.warn(` 获取视频 ${source}-${id} 详情失败`, err);
            // 可选择性收集失败信息
            updateMessages.push(`<span  style="color: #999;">${title}: 获取失败</span>`);
          }
        })
      );
    }
    // 关闭进度弹窗 
    await Swal.close(); 
    // ✅ 1. 使用 Swal 显示更新结果
    if (hasChanges) {
      const messageHtml = `
        <div style="text-align: left;">
          <p><strong>以下剧集发现新集数：</strong></p>
          <ul style="list-style-position: inside; margin-left: 10px;">
            ${updateMessages.map(msg  => `<li>${msg}</li>`).join('')}
          </ul>
        </div>
      `;
 
      await Swal.fire({ 
        title: '🎉 更新完成',
        html: messageHtml,
        icon: 'success',
        confirmButtonText: '确认',
        didClose: () => {
          console.log('[  更新剧集] 用户关闭弹窗');
        }
      });
 
      // ✅ 3. 重新加载播放记录
      console.log('[  更新剧集] 检测到数据变化,重新加载播放记录');
      
    } else {
      let messageHtml = '<p>所有剧集已是最新，未发现新增集数。</p>';
      if (updateMessages.length  > 0) {
        messageHtml += `
          <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
            （部分剧集获取失败）
          </p>`;
      }
 
      await Swal.fire({ 
        title: '🔄 检查完成',
        html: messageHtml,
        icon: 'info',
        confirmButtonText: '确认'
      });
    }
  } catch (error) {
    console.error(' 批量更新剧集失败:', error);
 
    // 错误处理弹窗
    Swal.fire({ 
      title: '❌ 更新过程中发生错误',
      text: error instanceof Error ? error.message  : '未知错误',
      icon: 'error',
      confirmButtonText: '确认'
    });
  } finally {
    setRefreshing(false);
    console.log('[  更新剧集] 更新流程结束,设置 refreshing = false');
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
        {!loading && playRecords.length > 0 && (
		<>
		  {/* 更新剧集按钮 */}
          <button
            className={`text-sm px-2 py-1 text-white rounded-lg transition-colors 
              ${refreshing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-700'
              }`}
            onClick={handleUpdateAllEpisodes}
            disabled={refreshing}
            title={refreshing ? "正在更新..." : "检查是否有新剧集"}
          >
            {refreshing ? "更新中..." : "更新剧集"}
          </button>
          <button
            className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            onClick={async () => {
              await clearAllPlayRecords();
              setPlayRecords([]);
            }}
          >
            清空
          </button>
		  </>
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
                {/* 新增：单独更新按钮 */}
                <div className="mt-2 flex justify-center">
                  <button
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      refreshing
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateSingleEpisode(record);
                    }}
                    disabled={refreshing}
                    title={refreshing ? "正在更新..." : "检查该视频是否有新剧集"}
                  >
                    {refreshing ? "更新中..." : "更新剧集"}
                  </button>
                </div>
                </div>
              );
            })}
      </ScrollableRow>
    </section>
  );
}
