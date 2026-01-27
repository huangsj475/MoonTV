import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const encodedVideoUrl = searchParams.get('url');
  
  if (!encodedVideoUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    const videoUrl = decodeURIComponent(encodedVideoUrl);
    const targetUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
    
    console.log('🚀 获取原始页面...');
    
    const response = await fetch(targetUrl);
    let html = await response.text();
    
    // 🎯 1. 移除广告JS
    const adScriptPattern = /<script[^>]*src=['"]\/\/pc\.stgowan\.com\/pc\/video-tf\.js['"][^>]*><\/script>/gi;
    html = html.replace(adScriptPattern, '<!-- 广告JS已移除 -->');
    
    // 🎯 2. 移除广告div
    const adDivPattern = /<div[^>]*id=['"]adv_wrap_hh['"][^>]*>[\s\S]*?<\/div>/gi;
    html = html.replace(adDivPattern, '<!-- 广告div已移除 -->');
    
    // 🎯 3. 移除其他可能广告
    
    otherAds.forEach(pattern => {
      html = html.replace(pattern, '');
    });
    
    // 🎯 4. 修复相对路径
    html = html.replace(/(src|href)=['"]\/\/([^'"]+)['"]/g, '$1="https://$2"');
    html = html.replace(/(src|href)=['"]\/([^'"]+)['"]/g, '$1="https://jx.xmflv.cc/$2"');
    
    // 🎯 5. 确保有base标签
    if (!html.includes('<base ')) {
      html = html.replace(
        /<head>/i, 
        '<head>\n<base href="https://jx.xmflv.cc/" target="_blank">'
      );
    }
    
    // 🎯 6. 移除反iframe/反代理代码
    const antiScripts = [
      /if\s*\([^)]*top[^)]*!==[^)]*self[^)]*\)[^{]*{[^}]*location[^}]*}/gi,
      /if\s*\([^)]*parent[^)]*!==[^)]*window[^)]*\)[^{]*{[^}]*}/gi,
      /document\.domain\s*=/gi,
    ];
    
    antiScripts.forEach(pattern => {
      html = html.replace(pattern, '// 已移除安全限制');
    });
    
    // 🎯 7. 添加我们自己的控制脚本
    const controlScript = `
      <script>
        // 修复可能的事件监听
        window.addEventListener('error', (e) => {
          if (e.message.includes('cross-origin')) {
            e.preventDefault();
          }
        }, true);
      </script>
    `;
    
    html = html.replace('</head>', controlScript + '</head>');
    
    console.log('✅ 页面处理完成，可直接渲染');
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error: any) {
    console.error('❌ 代理失败:', error?.message);
    
    return new NextResponse(JSON.stringify({
      error: '代理失败',
      message: error?.message,
      directUrl: `https://jx.xmflv.cc/?url=${encodeURIComponent(decodeURIComponent(encodedVideoUrl))}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
