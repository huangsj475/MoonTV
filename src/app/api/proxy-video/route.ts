/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || '';
  
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  const yourDomain = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  
  console.log('直接代理视频页面到iframe');
  
  try {
    // 不再修改HTML，直接返回重定向或简单页面
    const directIframeHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>视频播放器 - 直接模式</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #000;
          }
          .container {
            width: 100%;
            height: 100%;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          .error {
            color: white;
            text-align: center;
            padding: 50px;
            font-family: Arial;
          }
        </style>
        <script>
          // 尝试绕过一些iframe检测
          try {
            // 伪装一些属性
            if (window.top !== window.self) {
              window.isInIframe = true;
              // 尝试修复某些检测
              try {
                Object.defineProperty(window, 'top', { 
                  get: function() { return window; },
                  configurable: true 
                });
                Object.defineProperty(window, 'parent', { 
                  get: function() { return window; },
                  configurable: true 
                });
              } catch(e) {}
            }
          } catch(e) {}
        </script>
      </head>
      <body>
        <div class="container">
          <iframe 
            id="playerFrame"
            src="${playerUrl}"
            title="视频播放器"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-presentation"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowfullscreen
            referrerpolicy="no-referrer-when-downgrade"
            scrolling="no"
          ></iframe>
        </div>
        
        <script>
          // 监听iframe加载
          const iframe = document.getElementById('playerFrame');
          
          // 尝试注入脚本到iframe
          setTimeout(() => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              
              // 注入一个脚本，尝试绕过检测
              const script = iframeDoc.createElement('script');
              script.textContent = \`
                try {
                  // 绕过iframe检测 - 方法1
                  if (typeof window.top !== 'undefined' && window.top !== window.self) {
                    // 重写检测逻辑
                    const originalToString = Function.prototype.toString;
                    Function.prototype.toString = function() {
                      const str = originalToString.call(this);
                      if (str.includes('top!==self') || str.includes('top != self') || 
                          str.includes('window.top!==window.self') || str.includes('parent!==window')) {
                        return str.replace(/top\\s*!==?\\s*self|window\\.top\\s*!==?\\s*window\\.self|parent\\s*!==?\\s*window/gi, 'false');
                      }
                      return str;
                    };
                    
                    // 方法2：重写关键函数
                    const checkers = ['checkIframe', 'iframeCheck', 'isInIframe', 'checkFrame'];
                    checkers.forEach(funcName => {
                      if (typeof window[funcName] === 'function') {
                        window[funcName] = function() { return false; };
                      }
                    });
                    
                    console.log('已尝试绕过iframe检测');
                  }
                } catch(e) {
                  console.log('绕过检测失败:', e.message);
                }
              \`;
              
              iframeDoc.head.appendChild(script);
            } catch(e) {
              // 跨域错误，正常
            }
          }, 2000);
          
          // 如果iframe失败，显示错误
          iframe.onerror = function() {
            document.body.innerHTML = \`
              <div class="error">
                <h2>播放器加载失败</h2>
                <p>请尝试：</p>
                <p><a href="${playerUrl}" target="_blank" style="color: #4dabf7;">直接访问播放器</a></p>
                <p><a href="${yourDomain}/api/proxy-api?url=\${encodeURIComponent(playerUrl)}" style="color: #4dabf7;">使用JS代理模式</a></p>
              </div>
            \`;
          };
        </script>
      </body>
      </html>
    `;
    
    return new NextResponse(directIframeHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
        'Content-Security-Policy': "frame-ancestors 'self' *",
      },
    });
    
  } catch (error) {
    console.error('代理失败:', error);
    
    // 最简单的回退：直接iframe
    const fallbackHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>视频播放器</title>
        <style>body,html{margin:0;padding:0;height:100%;} iframe{width:100%;height:100%;border:none;}</style>
      </head>
      <body>
        <iframe src="${playerUrl}" sandbox="allow-scripts allow-same-origin"></iframe>
      </body>
      </html>
    `;
    
    return new NextResponse(fallbackHtml, { headers: { 'Content-Type': 'text/html' } });
  }
}
