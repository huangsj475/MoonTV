import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resourceUrl = searchParams.get('url');
  
  if (!resourceUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    // 解码URL
    const decodedUrl = decodeURIComponent(resourceUrl);
    console.log('代理资源:', decodedUrl);
    
    // 构建请求头
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'https://jx.xmflv.cc/',
    };
    
    // 如果请求的是202.189.8.170
    if (decodedUrl.includes('202.189.8.170')) {
      headers['Host'] = '202.189.8.170';
      headers['Origin'] = 'https://jx.xmflv.cc';
    }
    
    // 发起请求
    const response = await fetch(decodedUrl, { headers });
    
    if (!response.ok) {
      console.error('资源请求失败:', response.status);
      return new NextResponse(null, { status: response.status });
    }
    
    // 获取内容
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = await response.arrayBuffer();
    
    // 返回响应
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    
  } catch (error) {
    console.error('代理失败:', error);
    return new NextResponse('Proxy error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // 对于POST请求，直接处理
  const { searchParams } = new URL(request.url);
  const resourceUrl = searchParams.get('url');
  
  if (!resourceUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    const decodedUrl = decodeURIComponent(resourceUrl);
    console.log('代理POST:', decodedUrl);
    
    // 获取原始请求体
    const body = await request.text();
    const headers = await request.headers;
    
    // 构建转发请求头
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://jx.xmflv.cc/',
    };
    
    // 添加原始Content-Type
    const contentType = headers.get('content-type');
    if (contentType) {
      forwardHeaders['Content-Type'] = contentType;
    }
    
    // 发起转发请求
    const response = await fetch(decodedUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: body,
    });
    
    const responseData = await response.arrayBuffer();
    const responseContentType = response.headers.get('content-type') || 'application/json';
    
    return new NextResponse(responseData, {
      headers: {
        'Content-Type': responseContentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('POST代理失败:', error);
    return new NextResponse('Proxy error', { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
