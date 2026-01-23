import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {

  const { searchParams } = new URL(request.url);
  const encodedVideoUrl = searchParams.get('proxyurl');
    if (!encodedVideoUrl) {
      return NextResponse.json({ error: 'URL参数是必需的' }, { status: 400 });
    }
  try {
    // 解码视频URL
    const videoUrl = decodeURIComponent(encodedVideoUrl);
    // 先用外部代理获取内容
    const externalProxyUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;

    const response = await fetch(externalProxyUrl);
    if (!response.ok) {
      throw new Error(`外部代理请求失败: ${response.status}`);
    }

      let html = await response.text();
      //去除加载广告的js
     /*html = html.replace(
      /<script[^>]*src=['"]\/\/pc\.stgowan\.com\/pc\/video-tf\.js['"][^>]*><\/script>/gi,
      ''
      );*/
    html = html.replace(
      /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/gi,
      ''
    );
      return new Response(html);
/*const adRegex = /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/gi;
const adMatches = html.match(adRegex);
console.log('找到广告div数量:', adMatches ? adMatches.length : 0);
      // 在本地清理广告
      html = html.replace(
      /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/gi,
      ''
      );
console.log('删除广告后HTML长度:', html.length);*/

     
      /*return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });*/

    /*let html = await response.text();
    
    // 在本地清理广告
    html = html.replace(
      /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/gi,
      ''
    );
    
    // 添加CSS确保隐藏
    const hideAdCSS = `
      <style>
        #adv_wrap_hh { 
          display: none !important; 
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
        }
      </style>
    `;
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${hideAdCSS}</head>`);
    } else {
      html = hideAdCSS + html;
    }
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
      },
    });*/
    
  } catch (error) {
    console.error('代理请求失败:', error);
    return NextResponse.json(
      { error: '代理请求失败' },
      { status: 500 }
    );
  }
}
