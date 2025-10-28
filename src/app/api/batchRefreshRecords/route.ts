import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites } from '@/lib/config';
import { getDetailFromApi } from '@/lib/downstream';
import { getAllPlayRecords, savePlayRecord } from '@/lib/db.client';

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

    const apiSites = await getAvailableApiSites();

    let updated = 0;
    let failed = 0;
    const updateMessages: string[] = [];

    for (const record of recordArray) {
      const { key, total_episodes: oldTotal, title } = record;
      const [source, id] = key.split('+');
      const apiSite = apiSites.find((site) => site.key === source);
      if (!apiSite) {
        updateMessages.push(`${title}: 来源无效`);
        failed++;
        continue;
      }
      try {
        const detail = await getDetailFromApi(apiSite, id);
        if (!detail?.episodes) {
          updateMessages.push(`${title}: 获取失败`);
          failed++;
          continue;
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
    }

    return NextResponse.json({
      updated,
      failed,
      messages: updateMessages,
      total: recordArray.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || JSON.stringify(err) || '批量刷新失败' },
      { status: 500 }
    );
  }
}
