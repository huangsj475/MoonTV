import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || '';
  
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
    
  // 方法1：直接替换条件判断 // 代理模式：绕过URL检查'
  /*const pattern = /p k=[^;]*;8\(k==""\|\|k=="18"\|\|k=="19"\)\{[^}]*\}l\{([^}]*)\}/;
  const match = html.match(pattern);
  
  if (match && match[1]) {
    // 提取 else 块内容
    const elseContent = match[1];
    // 用 else 块内容替换整个匹配
    html = html.replace(pattern, elseContent);
  }*/
   // 4. 修改HTML：注入JS来拦截爱奇艺请求
const injectScript = `
  <script>
    (function() {
      console.log('开始拦截爱奇艺API请求...');
      
      // 保存原始方法
      const originalFetch = window.fetch;
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      
      // 判断是否需要代理
      function shouldProxy(url) {
        if (!url) return false;
        const urlStr = url.toString();
        return urlStr.includes('iqiyi.com') || 
               urlStr.includes('qiyi.com') ||
               urlStr.includes('pps.tv') ||
               urlStr.includes('iqiyi');
      }
      
      // 创建代理URL
      function createProxyUrl(originalUrl) {
        return '/api/proxy-api?url=' + encodeURIComponent(originalUrl);
      }
      
      // 1. 拦截fetch请求（主要处理POST）
      window.fetch = async function(input, init = {}) {
        const url = input instanceof Request ? input.url : input;
        
        if (shouldProxy(url)) {
          const proxyUrl = createProxyUrl(url);
          console.log('拦截fetch请求:', url, '方法:', init.method || 'GET');
          
          // 构建新的请求
          const newInit = { ...init };
          
          // 如果是POST且有请求体，需要特殊处理
          if ((init.method || 'GET').toUpperCase() === 'POST' && init.body) {
            // 对于FormData，需要转换为可序列化的格式
            if (init.body instanceof FormData) {
              const formDataObj = {};
              for (let [key, value] of init.body.entries()) {
                formDataObj[key] = value;
              }
              newInit.body = JSON.stringify(formDataObj);
              newInit.headers = {
                ...init.headers,
                'Content-Type': 'application/json'
              };
            }
            // 其他类型的请求体保持不变
          }
          
          // 移除可能引起问题的头
          if (newInit.headers) {
            delete newInit.headers['host'];
          }
          
          try {
            return await originalFetch.call(this, proxyUrl, newInit);
          } catch (error) {
            console.error('代理请求失败:', error);
            // 失败时尝试原请求
            return originalFetch.call(this, input, init);
          }
        }
        
        return originalFetch.call(this, input, init);
      };
      
      // 2. 拦截XMLHttpRequest（很多库仍在使用）
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._method = method;
        this._url = url;
        
        if (shouldProxy(url)) {
          const proxyUrl = createProxyUrl(url);
          console.log('拦截XHR请求:', url, '方法:', method);
          return originalXHROpen.call(this, method, proxyUrl, ...rest);
        }
        
        return originalXHROpen.call(this, method, url, ...rest);
      };
      
      XMLHttpRequest.prototype.send = function(body) {
        this._body = body;
        
        // 如果是爱奇艺的POST请求，需要处理请求体
        if (this._method === 'POST' && shouldProxy(this._url)) {
          console.log('XHR发送POST数据:', this._url, body);
          
          // 如果请求头是FormData，转换为JSON
          const contentType = this.getRequestHeader('Content-Type');
          if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
            // 保持原样
          } else if (body instanceof FormData) {
            // 转换为JSON
            const formDataObj = {};
            for (let [key, value] of body.entries()) {
              formDataObj[key] = value;
            }
            body = JSON.stringify(formDataObj);
            this.setRequestHeader('Content-Type', 'application/json');
          }
        }
        
        return originalXHRSend.call(this, body);
      };
      
      // 3. 覆盖XMLHttpRequest的setRequestHeader以添加必要头
      const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        // 对于爱奇艺请求，移除或修改某些头
        if (shouldProxy(this._url)) {
          if (header.toLowerCase() === 'host') {
            return; // 跳过Host头
          }
          if (header.toLowerCase() === 'origin' && value.includes('iqiyi.com')) {
            value = window.location.origin; // 修改Origin
          }
        }
        return originalSetRequestHeader.call(this, header, value);
      };
      
      console.log('爱奇艺API拦截器已安装');
      
      // 4. 拦截动态脚本加载（爱奇艺可能用JS加载配置）
      const originalAppendChild = Element.prototype.appendChild;
      Element.prototype.appendChild = function(node) {
        if (node.tagName === 'SCRIPT' && node.src && shouldProxy(node.src)) {
          console.log('拦截动态script加载:', node.src);
          node.src = createProxyUrl(node.src);
        }
        return originalAppendChild.call(this, node);
      };
      
    })();
  </script>
`;
    // 5. 将脚本注入到页面中
    html = html.replace('</head>', injectScript + '</head>');
    
    // 移除广告div
    //html = html.replace(/<div\s+id="adv_wrap_hh"[^>]*>[\s\S]*?<\/div>/g, '');
    
    // 添加CSS隐藏广告
    const hideAdsCSS = `
      <style>
        #adv_wrap_hh { display: none !important; }
        [id*="adv"], [class*="adv"] { display: none !important; }
      </style>
    `;
    
    html = html.replace('</head>', `${hideAdsCSS}</head>`);
    
    // 修复资源路径
    //html = html.replace(/(src|href)="\/([^"]*)"/g, '$1="https://jx.xmflv.cc/$2"');
    
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
