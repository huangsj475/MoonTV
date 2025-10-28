import { NextRequest, NextResponse } from 'next/server';
import { fetchVideoDetail } from '@/lib/fetchVideoDetail';
import { getAllPlayRecords, savePlayRecord } from '@/lib/db.client';

export const runtime = 'edge';
// 适当调整BATCH_SIZE和每批之间的延时，防止被限流
const BATCH_SIZE = 5;
const SLEEP_MS = 500; // 每批之间等待0.5秒

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const allRecords = await getAllPlayRecords();
    const recordArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    if (recordArray.length === 0) {
      return NextResponse.json({ updated: 0, failed: 0, message: '无播放记录' });
    }

    let updated = 0;
    let failed = 0;
    const updateMessages: string[] = [];

    for (let i = 0; i < recordArray.length; i += BATCH_SIZE) {
      const batch = recordArray.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (record) => {
          const { key, total_episodes: oldTotal, title } = record;
          const [source, id] = key.split('+');
          try {
            const detail = await fetchVideoDetail({ source, id });
            if (!detail?.episodes) {
              updateMessages.push(`${title}: 获取失败`);
              failed++;
              return;
            }
            const newTotal = detail.episodes.length;
            if (newTotal > oldTotal) {
              await savePlayRecord(source, id, {
                ...record,
                total_episodes: newTotal,
                save_time: Date.now(),
              });
              updateMessages.push(`${title}: ${oldTotal} → ${newTotal}`);
              updated++;
            } else {
              updateMessages.push(`${title}: 无新增`);
            }
          } catch (err) {
            updateMessages.push(`${title}: 获取失败`);
            failed++;
          }
        })
      );
      if (i + BATCH_SIZE < recordArray.length) {
        await sleep(SLEEP_MS);
      }
    }

    return NextResponse.json({
      updated,
      failed,
      messages: updateMessages,
      total: recordArray.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || '批量刷新失败' },
      { status: 500 }
    );
  }
}
