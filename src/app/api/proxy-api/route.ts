import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let apiUrl = searchParams.get('url');
  
  if (!apiUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    // 解码 URL
    apiUrl = decodeURIComponent(apiUrl);
    
    // 确保 URL 是有效的
    let targetUrl = apiUrl;
    
    // 如果 URL 不包含协议，添加 http://
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `http://${targetUrl}`;
    }
    
    console.log('代理API请求:', targetUrl);
    
    // 复制重要 headers
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'https://jx.xmflv.cc/',
      'Origin': 'https://jx.xmflv.cc',
      'Host': '202.189.8.170',
    };
    
    // 添加请求头
    request.headers.forEach((value, key) => {
      // 复制一些有用的头
      if (key.toLowerCase() === 'accept-language' || 
          key.toLowerCase() === 'user-agent' ||
          key.toLowerCase() === 'referer') {
        headers[key] = value;
      }
    });
    
    const response = await fetch(targetUrl, { 
      headers,
      // 重要：处理重定向
      redirect: 'follow' as RequestRedirect,
    });
    
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    // 复制一些重要的响应头
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'public, max-age=3600',
    };
    
    return new NextResponse(data, {
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('API代理错误:', error);
    return new NextResponse('Proxy error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let apiUrl = searchParams.get('url');
  
  if (!apiUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    apiUrl = decodeURIComponent(apiUrl);
    
    let targetUrl = apiUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `http://${targetUrl}`;
    }
    
    const body = await request.text();
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://jx.xmflv.cc/',
      'Origin': 'https://jx.xmflv.cc',
      'Host': '202.189.8.170',
    };
    
    const response = await fetch(targetUrl, {
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
    console.error('POST代理错误:', error);
    return new NextResponse('Proxy error', { status: 500 });
  }
}

// 添加 OPTIONS 方法处理 CORS 预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
