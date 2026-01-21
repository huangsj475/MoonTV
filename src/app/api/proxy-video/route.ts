/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url') || '';
  const playerUrl = `https://jx.xmflv.cc/?url=${encodeURIComponent(videoUrl)}`;
  
  try {
    const response = await fetch(playerUrl);
    let html = await response.text();
    
    // 🎯 核心：只做这一件事 - 注入广告隐藏脚本
    const adRemovalScript = `
      <script>
        (function() {
          // 专门隐藏 adv_wrap_hh 这个div
          function hideAd() {
            const ad = document.getElementById('adv_wrap_hh');
            if (ad) {
              ad.style.display = 'none';
              ad.style.visibility = 'hidden';
              ad.style.opacity = '0';
              ad.style.pointerEvents = 'none';
              return true;
            }
            return false;
          }
          
          // 页面加载时立即执行
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
              hideAd();
              // 持续监控
              setInterval(hideAd, 500);
            });
          } else {
            hideAd();
            setInterval(hideAd, 500);
          }
          
          // 额外监听可能的显示事件
          const observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
              if (mutation.type === 'attributes' && 
                  mutation.attributeName === 'style') {
                hideAd();
              }
            }
          });
          
          observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['style']
          });
        })();
      </script>
    `;
    
    // 注入脚本
    html = html.replace('</head>', `${adRemovalScript}</head>`);
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
    
  } catch (error) {
    console.error('代理失败:', error);
    
    // 错误时直接返回原始页面（至少能播放）
    const response = await fetch(playerUrl);
    const html = await response.text();
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  }
}
