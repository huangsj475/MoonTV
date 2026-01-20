// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || 'https://www.iqiyi.com/v_egoc71bz3c.html';
  
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  
  console.log('代理请求:', playerUrl);
  
  try {
        // 获取第三方播放器页面
    const response = await fetch(playerUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    let html = await response.text();
    
    // 关键：直接移除包含URL检查的混淆JavaScript代码
    // 查找 <script type="text/javascript"> 到 </script> 之间的内容
    //const scriptRegex = /<script\s+type="text\/javascript">\s*eval\(function\(p,a,c,k,e,r\)[\s\S]*?<\/script>/g;
    
    const fixScript = `
      <script>
        // 代理修复：绕过URL检查
        (function() {
          // 在页面加载前拦截URL检查
          const originalDecodeURIComponent = decodeURIComponent;
          window.decodeURIComponent = function(encoded) {
            if (encoded && encoded.includes('url=')) {
              // 返回硬编码的URL，让k变量永远有值
              return 'url=${encodeURIComponent(videoUrl)}';
            }
            return originalDecodeURIComponent(encoded);
          };
          
          // 强制设置k变量
          Object.defineProperty(window, 'k', {
            get() { return '${videoUrl}'; },
            set() {}, // 防止修改
            configurable: true
          });
          
          console.log('代理：URL检查已绕过');
        })();
      </script>
    `;
    
    html = html.replace('</head>', `${fixScript}</head>`);

    
    // 移除广告div
    html = html.replace(/<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/g, '');
    
    // 添加CSS隐藏广告
    const hideAdsCSS = `
      <style>
        #adv_wrap_hh { display: none !important; }
        [id*="adv"], [class*="adv"] { display: none !important; }
      </style>
    `;
    
    html = html.replace('</head>', `${hideAdsCSS}</head>`);
    
    // 修复资源路径
    html = html.replace(/(src|href)="\/([^"]*)"/g, '$1="https://jx.xmflv.cc/$2"');
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
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
        <meta http-equiv="refresh" content="0;url=${playerUrl}" />
        <script>window.location.href = "${playerUrl}";</script>
      </head>
      <body>
        <p>正在跳转到播放器... <a href="${playerUrl}">点击这里</a></p>
      </body>
      </html>
    `;
    
    return new NextResponse(redirectHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
