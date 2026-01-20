import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 固定视频URL
    const videoUrl = 'https://www.iqiyi.com/v_egoc71bz3c.html';
    // 第三方播放器URL
    const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
    
    console.log('代理播放器URL:', playerUrl);
    
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    let html = await response.text();
    console.log('获取到HTML长度:', html.length);
    
    // 移除广告元素（精确匹配）
    const advPattern = /<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/g;
    const match = html.match(advPattern);
    if (match) {
      console.log('找到广告元素，长度:', match[0].length);
      html = html.replace(advPattern, '');
      console.log('已移除广告元素');
    }
    
    /*// 移除其他可能的广告
    const adPatterns = [
      /<div[^>]*class\s*=\s*["']?adv[\w\s-]*["']?[^>]*>[\s\S]*?<\/div>/gi,
      /<div[^>]*class\s*=\s*["']?ad[\w\s-]*["']?[^>]*>[\s\S]*?<\/div>/gi,
      /<div[^>]*id\s*=\s*["']?ad[\w\s-]*["']?[^>]*>[\s\S]*?<\/div>/gi,
      /<iframe[^>]*ad[^>]*>[\s\S]*?<\/iframe>/gi,
    ];
    
    adPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        console.log('找到其他广告元素，数量:', matches.length);
        html = html.replace(pattern, '');
      }
    });*/
    
    // 添加CSS隐藏广告
    const hideAdsCSS = `
      <style>
        /* 隐藏特定广告 */
        #adv_wrap_hh {
          display: none !important; 
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          position: absolute !important;
          left: -9999px !important;
        }
        
        
        /* 确保播放器正常显示 */
        #player, video, .video-player {
          width: 100% !important;
          height: 100% !important;
          position: relative !important;
          z-index: 1 !important;
        }
      </style>
    `;
    
    // 插入到head中
    html = html.replace('</head>', `${hideAdsCSS}</head>`);
    
    // 修复相对路径
    html = html.replace(/src="\//g, 'src="https://jx.xmflv.cc/');
    html = html.replace(/href="\//g, 'href="https://jx.xmflv.cc/');
    
    // 设置正确的内容类型
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('代理视频错误:', error);
    
    // 返回错误页面
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>播放器加载失败</title>
        <style>
          body { 
            margin: 0; 
            padding: 40px; 
            font-family: Arial, sans-serif; 
            background: #f0f0f0; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
          }
          .error-container { 
            background: white; 
            padding: 40px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            text-align: center; 
            max-width: 500px; 
          }
          h1 { color: #e53e3e; }
          button { 
            background: #3182ce; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 5px; 
            cursor: pointer; 
            margin-top: 20px; 
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>😢 播放器加载失败</h1>
          <p>错误信息: ${error instanceof Error ? error.message : '未知错误'}</p>
          <button onclick="window.location.reload()">重试</button>
          <button onclick="window.location.href='/play2'">返回</button>
        </div>
      </body>
      </html>
    `;
    
    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
}
