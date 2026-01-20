// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || 'https://www.iqiyi.com/v_egoc71bz3c.html';
  
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  
  console.log('代理请求:', playerUrl);
  
  try {
        // 获取第三方播放器页面
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://jx.xmflv.cc/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    let html = await response.text();
    
    // 关键：直接移除包含URL检查的混淆JavaScript代码
    // 查找 <script type="text/javascript"> 到 </script> 之间的内容
    const scriptRegex = /<script\s+type="text\/javascript">\s*eval\(function\(p,a,c,k,e,r\)[\s\S]*?<\/script>/g;
    
    if (scriptRegex.test(html)) {
      console.log('找到URL检查脚本，直接移除...');
      
      // 完全移除这个script标签
      html = html.replace(scriptRegex, '');

    }

    
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
