import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request, 'POST');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Origin, Referer',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleProxyRequest(request: NextRequest, method: string) {
  const { searchParams } = new URL(request.url);
  const resourceUrl = searchParams.get('url');
  
  if (!resourceUrl) return new NextResponse('Missing URL', { status: 400 });
  
  try {
    const decodedUrl = decodeURIComponent(resourceUrl);
    const urlObj = new URL(decodedUrl);
    const isIqiyi = urlObj.hostname.includes('iqiyi.com') || 
                    urlObj.hostname.includes('qiyi.com');
    
    console.log(`${method} 代理请求到: ${decodedUrl}, 爱奇艺: ${isIqiyi}`);
    
    // 获取请求体（如果是POST）
    let body = null;
    if (method === 'POST') {
      try {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          body = await request.json();
        } else if (contentType?.includes('application/x-www-form-urlencoded')) {
          body = await request.text();
        } else if (contentType?.includes('multipart/form-data')) {
          body = await request.formData();
        } else {
          body = await request.arrayBuffer();
        }
      } catch (e) {
        console.log('无法解析请求体:', e);
      }
    }
    
    // 构建请求头 - 模拟浏览器
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
    
    // 复制原始请求的重要头
    const originalHeaders = [
      'content-type',
      'referer', 
      'origin',
      'cookie',
      'x-requested-with',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'sec-fetch-dest',
      'sec-fetch-mode', 
      'sec-fetch-site',
      'sec-fetch-user',
    ];
    
    originalHeaders.forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        headers[header] = value;
      }
    });
    
    // 爱奇艺特殊处理
    if (isIqiyi) {
      // 强制设置一些爱奇艺需要的头
      headers['Accept'] = '*/*';
      headers['Origin'] = 'https://www.iqiyi.com';
      headers['Referer'] = 'https://www.iqiyi.com/';
      headers['Host'] = urlObj.host;
      
      // 如果没有Referer，设置默认值
      if (!headers['Referer']) {
        headers['Referer'] = 'https://www.iqiyi.com/';
      }
      
      // 爱奇艺API特定的头
      headers['t'] = Date.now().toString();
      headers['src'] = '76f90cbd92f94a2e';
      headers['sc'] = '0d5c4b2dcd9e4bb6';
      
      // 视频相关请求
      if (decodedUrl.includes('videos') || decodedUrl.includes('play')) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      }
    }
    
    // 构建fetch选项
    const fetchOptions: RequestInit = {
      method: method,
      headers: headers,
      redirect: 'follow',
    };
    
    // 如果有请求体
    if (body) {
      if (body instanceof ArrayBuffer) {
        fetchOptions.body = body;
      } else if (body instanceof FormData) {
        fetchOptions.body = body;
      } else if (typeof body === 'string') {
        fetchOptions.body = body;
      } else if (typeof body === 'object') {
        // JSON数据
        fetchOptions.body = JSON.stringify(body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }
    
    console.log('发送请求头:', headers);
    
    const response = await fetch(decodedUrl, fetchOptions);
    
    console.log(`收到响应: ${response.status} ${response.statusText}`);
    
    // 获取响应数据
    const responseData = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // 构建响应头
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Origin, Referer, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Set-Cookie',
    };
    
    // 复制重要的响应头
    const responseHeadersToCopy = [
      'content-length',
      'content-range', 
      'cache-control',
      'expires',
      'etag',
      'last-modified',
      'set-cookie',
      'x-cache',
      'x-powered-by',
    ];
    
    responseHeadersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders[header] = value;
      }
    });
    
    return new NextResponse(responseData, {
      headers: responseHeaders,
      status: response.status,
      statusText: response.statusText,
    });
    
  } catch (error) {
    console.error('代理请求失败:', error);
    return new NextResponse(`Proxy error: ${error}`, { status: 500 });
  }
}
