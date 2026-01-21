/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || '';
  
  // 第三方播放器URL
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  
  try {
    // 直接获取播放器页面，不经过CORS代理
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    console.log('获取解析url成功');
    let html = await response.text();
    const baseUrl = 'https://jx.xmflv.cc';
    
    // 修复资源URL
    html = html.replace(/(src|href)="\/([^"]*)"/g, `$1="${baseUrl}/$2"`);
    html = html.replace(/url\(['"]?\/([^)'"]*)['"]?\)/g, `url('${baseUrl}/$1')`);
    
    // 将页面中所有的API请求重定向到我们的代理
    /*html = html.replace(/https:\/\/202\.189\.8\.170(\/[^"']*)/g, (match, path) => {
      return `/api/proxy-api?url=${encodeURIComponent('https://202.189.8.170' + path)}`;
    });*/
    
    // 添加基础标签，确保相对路径正确
    html = html.replace('<head>', `<head><base href="${baseUrl}/">`);
    
    // 添加CORS头，允许iframe加载
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
    console.log('返回NextResponse');
  } catch (error) {
    console.error('代理失败:', error);
    
    // 返回一个直接包含iframe的简单页面
    return getFallbackPage(playerUrl);
  }
}

function getFallbackPage(playerUrl: string): NextResponse {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>视频播放器</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe 
    src="${playerUrl}"
    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    allow="autoplay; fullscreen; encrypted-media"
    allowfullscreen
  ></iframe>
</body>
</html>`;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
