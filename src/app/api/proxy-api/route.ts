import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let jsUrl = searchParams.get('url');
  
  if (!jsUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }
  
  try {
    // 解码URL
    jsUrl = decodeURIComponent(jsUrl);
    
    console.log('代理JS文件:', jsUrl);
    
    // 获取JavaScript文件
    const response = await fetch(jsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/javascript,*/*;q=0.8',
        'Referer': 'https://jx.xmflv.cc/',
      },
    });
    
    let jsContent = await response.text();
    
    // 🔥 关键：移除所有iframe检测代码
    // 模式1：直接的条件判断
    jsContent = jsContent.replace(
      /if\s*\(\s*(top|window\.top|self\.top|parent)\s*[!=]+\s*(self|window|window\.self)\s*\)/g,
      'if(false) // 已移除iframe检测'
    );
    
    // 模式2：try-catch中的检测
    jsContent = jsContent.replace(
      /try\s*{[^}]*top\s*!==?\s*self[^}]*}catch/g,
      'try{}catch'
    );
    
    // 模式3：函数调用检测
    jsContent = jsContent.replace(
      /function\s*\w*\s*\([^)]*\)\s*{[^}]*top\s*!==?\s*self[^}]*}/g,
      'function(){} // 已移除检测函数'
    );
    
    // 模式4：重写location的代码
    jsContent = jsContent.replace(
      /location\.(href|assign|replace)\s*=\s*[^;]+;/g,
      '// 已移除页面跳转'
    );
    
    // 模式5：直接设置top/parent
    jsContent = jsContent.replace(
      /(top|parent|window\.top|window\.parent)\s*=\s*/g,
      '// 已阻止重写: $1 ='
    );
    
    console.log('JS处理完成，原始大小:', response.headers.get('content-length'), '处理後:', jsContent.length);
    
    return new NextResponse(jsContent, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    
  } catch (error) {
    console.error('JS代理错误:', error);
    return new NextResponse('console.log("JS加载失败");', {
      headers: {
        'Content-Type': 'application/javascript',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
