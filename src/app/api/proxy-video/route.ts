/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

// 辅助函数：修复单个 URL
const fixUrl = (url: string): string => {
  // 跳过不需要处理的 URL
  if (!url || 
      url.startsWith('http://') || 
      url.startsWith('https://') || 
      url.startsWith('data:') || 
      url.startsWith('blob:') ||
      url.startsWith('#') ||
      url.startsWith('javascript:') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:')) {
    return url;
  }
  
  // 协议相对路径
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // 绝对路径
  if (url.startsWith('/')) {
    return `https://jx.xmflv.cc${url}`;
  }
  
  // 相对路径
  return `https://jx.xmflv.cc/${url}`;
};

// 统一处理资源路径
const fixResourcePaths = (htmlContent: string): string => {
  // 匹配所有的 src 和 href 属性
  const regex = /(src|href)=(["'])(.*?)\2/gi;
  let replacementCount = 0;
  
  const result = htmlContent.replace(regex, (match: string, attr: string, quote: string, url: string) => {
    const originalUrl = url;
    const fixedUrl = fixUrl(url);
    
    // 如果 URL 被修改了，记录一下
    if (originalUrl !== fixedUrl) {
      replacementCount++;
      console.log(`修复资源路径 ${replacementCount}: ${originalUrl} -> ${fixedUrl}`);
    }
    
    // 特别检查 Cloudflare 脚本
    if (originalUrl.includes('cloudflareinsights.com')) {
      console.log('找到 Cloudflare 脚本:', originalUrl, '修改后:', fixedUrl);
    }
    
    return `${attr}=${quote}${fixedUrl}${quote}`;
  });
  
  console.log(`总共修复了 ${replacementCount} 个资源路径`);
  return result;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || '';
  
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  
  console.log('代理请求:', playerUrl);
  
  try {
    // 获取第三方播放器页面，添加更多 headers 模拟浏览器
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://jx.xmflv.cc/',
        'Referrer-Policy': 'no-referrer-when-downgrade',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      },
      // 重要：保持 referrer 策略
      referrerPolicy: 'no-referrer-when-downgrade' as ReferrerPolicy,
       // 跟随重定向
      redirect: 'follow' as RequestRedirect,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    console.log('请求成功，状态码:', response.status);
    let html = await response.text();
    
    // 1. 移除反 iframe 的响应头相关设置
    html = html.replace(/<meta[^>]*X-Frame-Options[^>]*>/gi, '');
    html = html.replace(/<meta[^>]*Content-Security-Policy[^>]*frame-ancestors[^>]*>/gi, '');
    
    // 2. 修复资源路径 - 确保所有相对路径都变为绝对路径
    html = fixResourcePaths(html);
    
    // 4. 移除广告 div（使用更精确的选择器）
    const adPatterns = [
      /<div[^>]*id\s*=\s*["'][^"']*adv[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    ];
    
    adPatterns.forEach(pattern => {
      html = html.replace(pattern, '');
    });
    
    // 5. 添加 base 标签确保所有相对链接都正确
    if (!html.includes('<base ')) {
      html = html.replace(/<head>/i, '<head>\n<base href="https://jx.xmflv.cc/">');
    }
    
    // 6. 尝试移除可能阻止 iframe 加载的脚本
    const blockingScripts = [
      /if\s*\(top\s*!=\s*self\)[^}]*location\.href[^}]*}/gi,
      /if\s*\(window\.top\s*!=\s*window\.self\)[^}]*}/gi,
      /if\s*\(self\s*!=\s*top\)[^}]*}/gi,
    ];
    
    blockingScripts.forEach(pattern => {
      html = html.replace(pattern, '');// 已移除反iframe检查
    });
    
    console.log('HTML 处理完成，长度:', html.length);
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL', // 允许被 iframe 嵌入
        'Content-Security-Policy': "frame-ancestors 'self' *", // 允许所有来源嵌入
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
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="0;url=${playerUrl}" />
        <script>window.location.href = "${playerUrl}";</script>
      </head>
      <body style="margin:0;padding:20px;font-family:Arial;">
        <div style="text-align:center;margin-top:50px;">
          <p>正在跳转到播放器...</p>
          <p><a href="${playerUrl}">如果长时间没有跳转，请点击这里</a></p>
        </div>
      </body>
      </html>
    `;
    
    return new NextResponse(redirectHtml, {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  }
}
