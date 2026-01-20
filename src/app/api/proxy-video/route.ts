import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');
  
  if (!videoUrl) {
    return NextResponse.json({ error: 'Missing video URL' }, { status: 400 });
  }
  
  try {
    // 获取第三方播放器页面
    const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(playerUrl);
    let html = await response.text();
    
    // 移除广告元素
    html = html.replace(
      /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/g,
      ''
    );

    // 添加样式隐藏广告
    html = html.replace(
      '</head>',
      `<style>
        #adv_wrap_hh { display: none !important; }
        [id*="adv"], [class*="adv"], [id*="ad"], [class*="ad"] {
          display: none !important;
        }
      </style></head>`
    );
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('代理视频错误:', error);
    return NextResponse.json({ error: '失败获取视频' }, { status: 500 });
  }
}
