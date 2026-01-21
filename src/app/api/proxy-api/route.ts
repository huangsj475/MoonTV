import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resourceUrl = searchParams.get('url');
  
  if (!resourceUrl) return new NextResponse('Missing URL', { status: 400 });
  
  try {
    const decodedUrl = decodeURIComponent(resourceUrl);
    const urlObj = new URL(decodedUrl);
    const isIqiyi = urlObj.hostname.includes('iqiyi.com');
    
    // 构建请求头 - 关键就在这里！
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*', // 这个很重要！
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
    
    // 爱奇艺需要特殊的请求头
    if (isIqiyi) {
      // 这些头是爱奇艺API需要的
      headers['Accept'] = '*/*';
      headers['Origin'] = 'https://www.iqiyi.com';
      headers['Referer'] = 'https://www.iqiyi.com/';
      headers['Host'] = urlObj.host;
      headers['Sec-Fetch-Dest'] = 'empty';
      headers['Sec-Fetch-Mode'] = 'cors';
      headers['Sec-Fetch-Site'] = 'cross-site';
      
      // 对于视频流，可能需要额外的头
      if (decodedUrl.includes('.m3u8') || decodedUrl.includes('.mp4') || decodedUrl.includes('.ts')) {
        headers['Accept'] = '*/*';
        headers['Range'] = 'bytes=0-'; // 视频范围请求
      }
    } else {
      // 其他资源（第三方播放器的CSS、JS等）
      headers['Referer'] = 'https://jx.xmflv.cc/';
    }
    
    // 从原请求中复制Range头（用于视频分段加载）
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }
    
    console.log(`代理请求: ${decodedUrl}, 爱奇艺: ${isIqiyi}`);
    
    const response = await fetch(decodedUrl, { 
      headers,
      // 重要：不自动处理重定向，让浏览器处理
      redirect: 'manual'
    });
    
    // 处理重定向
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('location');
      if (location) {
        return NextResponse.redirect(
          `/api/proxy-resource?url=${encodeURIComponent(location)}`
        );
      }
    }
    
    if (!response.ok) {
      console.error(`资源请求失败 ${response.status}: ${decodedUrl}`);
      return new NextResponse(null, { status: response.status });
    }
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    const arrayBuffer = await response.arrayBuffer();
    
    // 构建响应头
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    };
    
    // 对于视频，支持范围请求
    if (contentType.includes('video/') || contentType.includes('application/vnd.apple.mpegurl')) {
      responseHeaders['Accept-Ranges'] = 'bytes';
      responseHeaders['Cache-Control'] = 'public, max-age=3600';
      if (contentLength) {
        responseHeaders['Content-Length'] = contentLength;
      }
      
      // 复制Range相关的头
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        responseHeaders['Content-Range'] = contentRange;
      }
    }
    
    // 对于JSON数据
    if (contentType.includes('application/json')) {
      responseHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }
    
    return new NextResponse(arrayBuffer, {
      headers: responseHeaders,
      status: response.status,
    });
    
  } catch (error) {
    console.error('资源代理失败:', error);
    return new NextResponse('Proxy error', { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400',
    },
  });
}
