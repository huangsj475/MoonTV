'use client';

import { createContext, ReactNode, useContext, useEffect, useState, useRef } from 'react';

// 扩展 Context 类型以支持更新函数
interface SiteContextType {
  siteName: string;
  announcement?: string;
  isLoading?: boolean;
}
const SiteContext = createContext<SiteContextType>({
  // 默认值
  siteName: 'MoonTV',
  announcement:'本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
  isLoading: false,
});

export const useSite = () => useContext(SiteContext);

export function SiteProvider({
  children,
  siteName,
  announcement,
}: {
  children: ReactNode;
  siteName: string;
  announcement?: string;
}) {
  const [siteName, setSiteName] = useState(initialSiteName);
  const [announcement, setAnnouncement] = useState(initialAnnouncement || '');
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);
    // 在客户端获取最新配置
  useEffect(() => {
	  
    const fetchLatestConfig = async () => {
	  if (!mountedRef.current) return;
	  setIsLoading(true);
      try {
        const response = await fetch('/api/site-config', {
          cache: 'no-store',
        });
        if (response.ok && mountedRef.current) {
          const result = await response.json();
          if (result.success) {
            // 使用函数式更新避免依赖
            setSiteName(prev => result.data.siteName !== prev ? result.data.siteName : prev);
            setAnnouncement(prev => result.data.announcement !== prev ? result.data.announcement : prev);
          }
        }
      } catch (error) {
		// 静默失败
      }finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };
    // 立即获取一次
    fetchLatestConfig();

  }, []); // 只在组件挂载时执行一次

  return (
    <SiteContext.Provider value={{ siteName, announcement, isLoading }}>
      {children}
    </SiteContext.Provider>
  );
}
