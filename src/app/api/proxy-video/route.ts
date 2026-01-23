import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('proxyurl');
    
    if (!url) {
      return NextResponse.json({ error: 'URL参数是必需的' }, { status: 400 });
    }
    
    // 先用外部代理获取内容
    const externalProxyUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(url)}`;
    const response = await fetch(externalProxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'manual'
    });
    // 检查重定向状态码
    if (response.status === 301 || response.status === 302) {
      const redirectUrl = response.headers.get('location');
      console.log('重定向到:', redirectUrl);
      // 重新请求重定向的URL
    }
    if (!response.ok) {
      throw new Error(`外部代理请求失败: ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
      // 根据类型处理
    if (contentType.includes('text/html')) {
      const html = await response.text();
      // 在本地清理广告
      const modifiedHtml = html.replace(
      /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/gi,
      ''
      );
      console.log('清理广告');
      return new Response(modifiedHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } 
    // 图片、CSS、JS等静态资源直接转发
    else {
      const buffer = await response.arrayBuffer();
      console.log('图片资源直接转发');
      return new Response(buffer, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }
    
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
