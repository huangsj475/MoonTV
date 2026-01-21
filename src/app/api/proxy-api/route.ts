import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiUrl = searchParams.get('url');
  
  if (!apiUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    const decodedUrl = decodeURIComponent(apiUrl);
    console.log('代理API请求:', decodedUrl);
    
    // 设置请求头
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'https://jx.xmflv.cc/',
      'Origin': 'https://jx.xmflv.cc',
      'Host': '202.189.8.170',
    };
    
    const response = await fetch(decodedUrl, { headers });
    
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    
  } catch (error) {
    console.error('API代理失败:', error);
    return new NextResponse('Proxy error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiUrl = searchParams.get('url');
  
  if (!apiUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    const decodedUrl = decodeURIComponent(apiUrl);
    const body = await request.text();
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://jx.xmflv.cc/',
      'Origin': 'https://jx.xmflv.cc',
      'Host': '202.189.8.170',
    };
    
    const response = await fetch(decodedUrl, {
      method: 'POST',
      headers,
      body,
    });
    
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('POST代理失败:', error);
    return new NextResponse('Proxy error', { status: 500 });
  }
}
