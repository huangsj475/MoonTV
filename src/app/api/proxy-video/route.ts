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
    const scriptRegex = /<script\s+type="text\/javascript">\s*eval\(function\(p,a,c,k,e,r\)[\s\S]*?<\/script>/g;
    
    html = html.replace(scriptRegex, (match, scriptContent) => {
      // 只修改包含URL检查的脚本
      if (scriptContent.includes('eval(function(p,a,c,k,e,r)')) {
        console.log('找到目标脚本，修改URL检查逻辑...');
        
        // 修改混淆代码中的URL检查部分
        // 将 "视频URL地址不能为空" 错误条件改为总是通过
        let modifiedScript = scriptContent;
        
        // 方法1：在eval执行前注入变量
        const injectBeforeEval = `
          // 代理模式：强制设置URL
          window._proxyVideoUrl = '${videoUrl}';
          window.url = '${videoUrl}';
          window.k = '${videoUrl}';
          window.vurl = '${videoUrl}';
          
          // 重写检查逻辑
          window._originalDecodeURIComponent = decodeURIComponent;
          decodeURIComponent = function(str) {
            if (str && str.includes('url=')) {
              return 'url=${encodeURIComponent(videoUrl)}';
            }
            return window._originalDecodeURIComponent(str);
          };
        `;
        
        // 在eval前插入我们的代码
        modifiedScript = modifiedScript.replace(
          'eval(function(p,a,c,k,e,r)',
          `${injectBeforeEval}eval(function(p,a,c,k,e,r)`
        );
        
        return `<script type="text/javascript">${modifiedScript}</script>`;
      }
      
      return match; // 其他脚本保持不变
    });

    
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
