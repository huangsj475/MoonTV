/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || '';
  
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  
  console.log('代理请求:', playerUrl);

  const requestUrl = new URL(request.url);
  const myDomain = `${requestUrl.protocol}//${requestUrl.host}`;
  try {
    // 获取第三方播放器页面
    const response = await fetch(playerUrl);
    let html = await response.text();
    
    // 第一步：让所有 API 请求走我们的代理
    // 第四步：注入一个脚本，动态处理后续的 API 请求
    const injectScript = `
      <script>
        // 动态拦截 API 请求
        (function() {
          const MY_DOMAIN = "${myDomain}";

          // 保存原始请求头
          const originalHeaders = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://jx.xmflv.cc',
            'Referer': 'https://jx.xmflv.cc/',
          };
          
          // 拦截 fetch
          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            if (typeof input === 'string' && input.includes('202.189.8.170/Api')) {
              const newUrl = MY_DOMAIN + '/api/proxy-api?url=' + encodeURIComponent(input);
              console.log('拦截 fetch 请求:', input, '->', newUrl);
            // 确保请求头正确
            if (init) {
              init.headers = {
                ...originalHeaders,
                ...init.headers,
              };
            } else {
              init = { headers: originalHeaders };
            }
              
              return originalFetch(newUrl, init);
            }
            return originalFetch(input, init);
          };
          
          // 拦截 XMLHttpRequest
          const originalOpen = XMLHttpRequest.prototype.open;
          const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
          XMLHttpRequest.prototype.open = function(method, url) {
            if (url && url.includes('202.189.8.170/Api')) {
              const newUrl = MY_DOMAIN + '/api/proxy-api?url=' + encodeURIComponent(url);
              console.log('拦截 XHR 请求:', url, '->', newUrl);
              // 保存原始 URL 以便后续设置请求头
              this._originalUrl = url;
              arguments[1] = newUrl;
            }
            return originalOpen.apply(this, arguments);
          };

          XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
            // 如果请求的是代理 API，修改 Origin 头
            if (header.toLowerCase() === 'origin' && this._originalUrl) {
              value = 'https://jx.xmflv.cc';
            }
            return originalSetRequestHeader.call(this, header, value);
          };
          
          // 处理动态创建的 script 或 iframe
          const originalCreateElement = document.createElement;
          document.createElement = function(tagName) {
            const element = originalCreateElement.call(document, tagName);
            if (tagName.toLowerCase() === 'script') {
              const originalSetAttribute = element.setAttribute;
              element.setAttribute = function(name, value) {
                if (name === 'src' && value && value.includes('202.189.8.170/Api')) {
                  value = MY_DOMAIN + '/api/proxy-api?url=' + encodeURIComponent(value);
                  console.log('拦截 script src:', value);
                }
                return originalSetAttribute.call(this, name, value);
              };
            }
            return element;
          };
        })();
      </script>
    `;
    
    html = html.replace('</head>', `${injectScript}</head>`);
    
    console.log('处理后续的 API 请求脚本注入');
    
    // 第二步：修复资源路径（简单版）
    // 1. 处理 // 开头的协议相对路径
    html = html.replace(/(src|href)=(["'])\/\/([^"']+)\2/gi, '$1=$2https://$3$2');
    
    // 2. 处理 / 开头的绝对路径
    html = html.replace(/(src|href)=(["'])\/(?!Api)([^"']+)\2/gi, '$1=$2https://jx.xmflv.cc/$3$2');
    // 第三步：添加 base 标签
    if (!html.includes('<base ')) {
      html = html.replace(/<head>/i, '<head>\n<base href="https://jx.xmflv.cc/">');
    }
    
    // 第四步：移除明显的广告 div
    html = html.replace(/<div[^>]*id\s*=\s*["'][^"']*adv[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
    
    console.log('HTML 处理完成');
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
    
  } catch (error) {
    console.error('代理失败:', error);
    
    // 返回一个简单的重定向页面
    const redirectHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>正在跳转</title>
        <base href="https://jx.xmflv.cc/">
        <meta http-equiv="refresh" content="0;url=${playerUrl}" />
        <script>window.location.href = "${playerUrl}";</script>
      </head>
      <body style="margin:0;padding:20px;">
        <p>正在跳转到播放器... <a href="${playerUrl}">点击这里</a></p>
      </body>
      </html>
    `;
    
    return new NextResponse(redirectHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
