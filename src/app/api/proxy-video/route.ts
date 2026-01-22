import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL参数是必需的' }, { status: 400 });
    }
    
    // 先用外部代理获取内容
    const externalProxyUrl = `https://go.netlist.dpdns.org/cors/?url=${url}`;
    const response = await fetch(externalProxyUrl);
    
    if (!response.ok) {
      throw new Error(`外部代理请求失败: ${response.status}`);
    }
    
    let html = await response.text();
    
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
    });
    
  } catch (error) {
    console.error('代理请求失败:', error);
    return NextResponse.json(
      { error: '代理请求失败' },
      { status: 500 }
    );
  }
}
