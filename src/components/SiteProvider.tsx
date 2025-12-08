'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// 扩展 Context 类型以支持更新函数
interface SiteContextType {
  siteName: string;
  announcement?: string;
  updateSiteConfig: (config: { siteName?: string; announcement?: string }) => void;
}
const SiteContext = createContext<SiteContextType>({
  // 默认值
  siteName: 'MoonTV',
  announcement:'本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
  updateSiteConfig: () => {},
});

export const useSite = () => useContext(SiteContext);

export function SiteProvider({
  children,
  initialSiteName,
  initialAnnouncement,
}: {
  children: ReactNode;
  initialSiteName: string;
  initialAnnouncement?: string;
}) {
  const [siteName, setSiteName] = useState(initialSiteName);
  const [announcement, setAnnouncement] = useState(initialAnnouncement || '');
    // 在客户端获取最新配置
  useEffect(() => {
    const fetchLatestConfig = async () => {
      try {
        const response = await fetch('/api/site-config');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            if (result.data.siteName && result.data.siteName !== siteName) {
              setSiteName(result.data.siteName);
            }
            if (result.data.announcement && result.data.announcement !== announcement) {
              setAnnouncement(result.data.announcement);
            }
          }
        }
      } catch (error) {
        console.warn('获取最新站点配置失败:', error);
      }
    };

    // 延迟执行，避免阻塞页面初始渲染
    const timer = setTimeout(fetchLatestConfig, 100);
    return () => clearTimeout(timer);
  }, []); // 只在组件挂载时执行一次
    // 更新配置的函数
  const updateSiteConfig = (config: { siteName?: string; announcement?: string }) => {
    if (config.siteName !== undefined) {
      setSiteName(config.siteName);
    }
    if (config.announcement !== undefined) {
      setAnnouncement(config.announcement);
    }
  };
  return (
    <SiteContext.Provider value={{ siteName, announcement, updateSiteConfig }}>
      {children}
    </SiteContext.Provider>
  );
}
