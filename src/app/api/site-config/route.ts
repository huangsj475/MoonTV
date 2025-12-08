import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const runtime = 'edge';

export async function GET() {
  try {
    const config = await getConfig();
    
    return NextResponse.json({
      success: true,
      data: {
        siteName: config?.SiteConfig?.SiteName || process.env.SITE_NAME || 'MoonTV',
        announcement: config?.SiteConfig?.Announcement || process.env.ANNOUNCEMENT || '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      }
    });
  } catch (error) {
    console.error('API: 获取站点配置失败:', error);
    
    return NextResponse.json({
      success: false,
      error: '获取配置失败',
      data: {
        siteName: process.env.SITE_NAME || 'MoonTV',
        announcement: process.env.ANNOUNCEMENT || '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      }
    });
  }
}
