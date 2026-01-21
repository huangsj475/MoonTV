/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || '';
  
  // 使用公共CORS代理
  const corsProxy = 'https://cors-anywhere.herokuapp.com/';
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  const proxiedUrl = corsProxy + playerUrl;
  
  try {
    // 获取播放器页面
    const response = await fetch(proxiedUrl, {
      headers: {
        'Origin': 'https://jx.xmflv.cc',
        'User-Agent': 'Mozilla/5.0',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    let html = await response.text();
    
    // 修复所有资源链接
    const baseUrl = 'https://jx.xmflv.cc';
    html = fixResourceUrls(html, baseUrl);
    
    // 添加CORS代理到所有请求
    html = addCorsProxyToScripts(html);
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('代理失败:', error);
    // 返回iframe包装页面
    return getFallbackPage(playerUrl);
  }
}

function fixResourceUrls(html: string, baseUrl: string): string {
  // 修复相对路径
  html = html.replace(/src="\/([^"]*)"/g, `src="${baseUrl}/$1"`);
  html = html.replace(/href="\/([^"]*)"/g, `href="${baseUrl}/$1"`);
  html = html.replace(/url\(\'\/([^']*)\'\)/g, `url('${baseUrl}/$1')`);
  html = html.replace(/url\("\/\/([^)]*)"\)/g, `url("https://$1")`);
  
  return html;
}

function addCorsProxyToScripts(html: string): string {
  const corsProxy = 'https://cors-anywhere.herokuapp.com/';
  
  // 添加脚本拦截器
  const script = `
    <script>
      (function() {
        // 代理fetch
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
          if (typeof url === 'string' && !url.startsWith('blob:')) {
            if (!url.startsWith('http')) {
              url = 'https://jx.xmflv.cc' + (url.startsWith('/') ? url : '/' + url);
            }
            url = '${corsProxy}' + url;
          }
          return originalFetch.call(this, url, options);
        };
        
        // 代理XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          if (typeof url === 'string' && !url.startsWith('blob:')) {
            if (!url.startsWith('http')) {
              url = 'https://jx.xmflv.cc' + (url.startsWith('/') ? url : '/' + url);
            }
            url = '${corsProxy}' + url;
          }
          return originalOpen.apply(this, [method, url, ...args]);
        };
        
        // 修复已加载的资源
        document.addEventListener('DOMContentLoaded', function() {
          // 修复script标签
          document.querySelectorAll('script[src]').forEach(script => {
            let src = script.getAttribute('src');
            if (src && !src.startsWith('blob:')) {
              if (!src.startsWith('http')) {
                src = 'https://jx.xmflv.cc' + (src.startsWith('/') ? src : '/' + src);
              }
              script.src = '${corsProxy}' + src;
            }
          });
          
          // 修复iframe
          document.querySelectorAll('iframe[src]').forEach(iframe => {
            let src = iframe.getAttribute('src');
            if (src && src.includes('202.189.8.170')) {
              iframe.src = '${corsProxy}' + src;
            }
          });
        });
      })();
    </script>
  `;
  
  return html.replace('</head>', script + '</head>');
}

function getFallbackPage(playerUrl: string): NextResponse {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>播放器</title>
      <style>
        body { margin: 0; padding: 0; background: #000; }
        iframe { width: 100vw; height: 100vh; border: none; }
      </style>
    </head>
    <body>
      <iframe src="${playerUrl}" sandbox="allow-scripts allow-same-origin"></iframe>
    </body>
    </html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
