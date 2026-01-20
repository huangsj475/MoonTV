import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
    const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
    
    console.log('获取播放器页面:', playerUrl);
    
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    let html = await response.text();
    
    // 关键：在页面加载前注入代码，模拟window.location
    const injectScript = `
      <script>
        // 在页面任何代码执行之前重写window.location
        (function() {
          // 保存原始URL
          const originalSearch = '?url=${encodeURIComponent(videoUrl)}';
          const originalHref = 'https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}';
          
          // 重写window.location对象
          Object.defineProperty(window, 'location', {
            configurable: false,
            get: function() {
              return {
                search: originalSearch,
                href: originalHref,
                origin: 'https://jx.xmflv.cc',
                protocol: 'https:',
                host: 'jx.xmflv.cc',
                hostname: 'jx.xmflv.cc',
                port: '',
                pathname: '/',
                hash: '',
                toString: function() { return originalHref; }
              };
            }
          });
          
          // 也重写document.location
          Object.defineProperty(document, 'location', {
            configurable: false,
            get: function() {
              return window.location;
            }
          });
          
          // 预定义URL变量，防止未定义错误
          window.VIDEO_URL = '${videoUrl}';
          window.url = '${videoUrl}';
          window.vurl = '${videoUrl}';
          
          console.log('已注入URL参数:', '${videoUrl}');
        })();
      </script>
    `;
    
    // 插入到最前面，确保在其他脚本之前执行
    html = html.replace('<head>', `<head>${injectScript}`);
    
    // 再添加一个后执行的脚本，确保URL被正确设置
    const afterScript = `
      <script>
        // DOM加载后再次检查
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOM加载完成，当前URL:', window.location.search);
          
          // 如果需要，可以手动触发页面初始化
          setTimeout(function() {
            // 查找页面中的URL输入框并设置值
            var inputs = document.querySelectorAll('input');
            inputs.forEach(function(input) {
              if (input.type === 'text' || input.type === 'url') {
                input.value = '${videoUrl}';
                // 触发事件
                var event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
              }
            });
          }, 500);
        });
      </script>
    `;
    
    html = html.replace('</body>', `${afterScript}</body>`);
    
    // 移除广告div
    html = html.replace(/<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/g, '');
    
    // 修复资源路径
    html = html.replace(/(src|href)="\/([^"]*)"/g, '$1="https://jx.xmflv.cc/$2"');
    
    // 添加CSS确保广告被隐藏
    const hideCss = `
      <style>
        #adv_wrap_hh { display: none !important; }
        [id*="adv"], [class*="adv"] { display: none !important; }
      </style>
    `;
    
    html = html.replace('</head>', `${hideCss}</head>`);
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('代理错误:', error);
    
    // 回退：直接返回带iframe的页面
    const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
    const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
    
    const fallbackHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>视频播放器</title>
        <style>
          body, html { margin: 0; padding: 0; height: 100%; }
          iframe { width: 100%; height: 100%; border: none; }
          .ad-overlay {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            height: 400px;
            background: black;
            z-index: 10000000;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div class="ad-overlay"></div>
        <iframe src="${playerUrl}" allowfullscreen></iframe>
      </body>
      </html>
    `;
    
    return new NextResponse(fallbackHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
