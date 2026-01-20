import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 检查我们自己的URL有没有参数
  const videoUrlFromOurUrl = searchParams.get('url');
  
  if (!videoUrlFromOurUrl) {
    // 如果我们的URL没有参数，添加参数重定向
    const fixedVideoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
    const newUrl = new URL(request.url);
    newUrl.searchParams.set('url', fixedVideoUrl);
    
    console.log('重定向到带参数的URL:', newUrl.toString());
    return NextResponse.redirect(newUrl);
  }
  
  // 我们的URL有参数了，现在去请求第三方
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrlFromOurUrl)}`;
  
  console.log('请求第三方:', playerUrl);
  
  try {
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    let html = await response.text();
    
    // 移除广告div
    html = html.replace(/<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/g, '');
    
    // 添加CSS隐藏广告
    const hideAdsCSS = `
      <style>
        #adv_wrap_hh { display: none !important; }
      </style>
    `;
    
    html = html.replace('</head>', `${hideAdsCSS}</head>`);
    
    // 修复资源路径
    html = html.replace(/(src|href)="\/([^"]*)"/g, '$1="https://jx.xmflv.cc/$2"');
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('代理失败:', error);
    
    // 返回简单错误页面
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>错误</title></head>
      <body><h1>播放器加载失败</h1></body>
      </html>
    `;
    
    return new NextResponse(errorHtml, { status: 500 });
  }
}
