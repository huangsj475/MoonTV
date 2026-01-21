import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request, 'POST');
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Vary': 'Origin',
    },
  });
}

async function handleProxyRequest(request: NextRequest, method: 'GET' | 'POST') {
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
    
    console.log('代理API请求:', targetUrl, '方法:', method);
    
    // 复制重要的请求头 - 关键修复！
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      // 关键：保持原始请求的 Origin 和 Referer
      'Origin': 'https://jx.xmflv.cc',
      'Referer': 'https://jx.xmflv.cc/',
      // 关键：Host 头必须是目标服务器的
      'Host': '202.189.8.170',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Ch-Ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Priority': 'u=1, i',
    };
    
    // 对于 POST 请求，添加正确的 Content-Type
    if (method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    }
    
    // 准备请求选项
    const fetchOptions: RequestInit = {
      method,
      headers,
      redirect: 'follow' as RequestRedirect,
    };
    
    // 如果是 POST 请求，传递请求体
    if (method === 'POST') {
      const body = await request.text();
      fetchOptions.body = body;
      console.log('POST 请求体长度:', body.length);
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    // 获取响应数据
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    // 创建响应头
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };
    
    // 复制一些重要的响应头
    const headersToCopy = [
      'cache-control',
      'expires',
      'pragma',
      'content-encoding',
      'content-length',
    ];
    
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders[header] = value;
      }
    });
    
    console.log('API 代理成功，状态码:', response.status);
    
    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('API代理错误:', error);
    return new NextResponse(JSON.stringify({ 
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}
