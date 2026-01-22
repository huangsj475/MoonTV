// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL参数是必需的' },
        { status: 400 }
      );
    }
    
    // 解码URL
    const decodedUrl = decodeURIComponent(url);
    
    // 这里你可以添加额外的安全检查
    // 例如，限制只允许特定的域名
    const allowedDomains = ['iqiyi.com', 'jx.xmflv.cc'];
    const isAllowed = allowedDomains.some(domain => decodedUrl.includes(domain));
    
    if (!isAllowed) {
      return NextResponse.json(
        { error: '不允许的域名' },
        { status: 403 }
      );
    }
    
    // 发起请求
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://jx.xmflv.cc/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    
    // 获取响应文本
    const html = await response.text();
    //去广告div
    html = html.replace(
      /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/gi,
      ''
    );
    
    // 返回响应，设置适当的CORS头
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error) {
    console.error('代理请求失败:', error);
    return NextResponse.json(
      { error: '代理请求失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
