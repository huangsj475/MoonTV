/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import 'sweetalert2/dist/sweetalert2.min.css';

import { getConfig } from '@/lib/config';
import RuntimeConfig from '@/lib/runtime';

import { GlobalErrorIndicator } from '../components/GlobalErrorIndicator';
import { SiteProvider } from '../components/SiteProvider';
import { ThemeProvider } from '../components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

// 动态生成 metadata，支持配置更新后的标题变化
export async function generateMetadata(): Promise<Metadata> {
	/*
  let siteName = process.env.SITE_NAME || 'MoonTV';
  if (
    process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'd1' &&
    process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'upstash'
  ) {
    const config = await getConfig();
    siteName = config.SiteConfig.SiteName;
  }
  */
  
  //-------新更改---------
  let siteName = 'MoonTV'; // 默认值
 
  try {
    // 不管什么存储类型，都可以安全调用 getConfig()
    // getConfig() 内部已处理不同环境下的逻辑（Docker、Serverless、Redis等）
    const config = await getConfig();
 
    // 如果成功获取配置，则使用其中的 SiteName
	// 最终优先级：config > 环境变量 > 默认值
    if (config?.SiteConfig?.SiteName) {
      siteName = config.SiteConfig.SiteName;
	  console.log('获取到数据库站点名:', siteName);
    }
  } catch (e) {
    siteName = process.env.SITE_NAME  || 'MoonTV';
    console.warn('获取数据库值“站点名“失败，改为使用环境变量:', e);
    // 失败时降级：继续检查环境变量
  }
 
  
	//-------新更改---------
	
  return {
    title: siteName,
    description: '影视聚合',
    manifest: '/manifest.json',
  };
}

export const viewport: Viewport = {
  themeColor: '#000000',
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
	/*----原来的-----
  let siteName = process.env.SITE_NAME || 'MoonTV';
  let announcement =
    process.env.ANNOUNCEMENT ||
    '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';
  let enableRegister = process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true';
  let imageProxy = process.env.NEXT_PUBLIC_IMAGE_PROXY || '';
  let doubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY || '';
  let disableYellowFilter =
    process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true';
  let customCategories =
    (RuntimeConfig as any).custom_category?.map((category: any) => ({
      name: 'name' in category ? category.name : '',
      type: category.type,
      query: category.query,
    })) || ([] as Array<{ name: string; type: 'movie' | 'tv'; query: string }>);
  if (
    process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'd1' &&
    process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'upstash'
  ) {
    const config = await getConfig();
    siteName = config.SiteConfig.SiteName;
    announcement = config.SiteConfig.Announcement;
    enableRegister = config.UserConfig.AllowRegister;
    imageProxy = config.SiteConfig.ImageProxy;
    doubanProxy = config.SiteConfig.DoubanProxy;
    disableYellowFilter = config.SiteConfig.DisableYellowFilter;
    customCategories = config.CustomCategories.filter(
      (category) => !category.disabled
    ).map((category) => ({
      name: category.name || '',
      type: category.type,
      query: category.query,
    }));
  }
  */
  //----原来的-----
  //------------修改后-------------
  /*
 // 先获取配置（无论存储类型是什么）
const config = await getConfig();
 
// 优先级：config.SiteConfig > 环境变量 > 默认值
const siteName = config.SiteConfig?.SiteName || process.env.SITE_NAME  || 'MoonTV';
const announcement = 
  config.SiteConfig?.Announcement || 
  process.env.ANNOUNCEMENT  || 
  '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';
const enableRegister = 
  config.UserConfig?.AllowRegister ?? 
  (process.env.NEXT_PUBLIC_ENABLE_REGISTER  === 'true');
const imageProxy = 
  config.SiteConfig?.ImageProxy || 
  process.env.NEXT_PUBLIC_IMAGE_PROXY  || 
  '';
const doubanProxy = 
  config.SiteConfig?.DoubanProxy || 
  process.env.NEXT_PUBLIC_DOUBAN_PROXY  || 
  '';
const disableYellowFilter = 
  config.SiteConfig?.DisableYellowFilter ?? 
  (process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER  === 'true');
const customCategories = 
  config.CustomCategories?.filter(category => !category.disabled).map(category  => ({
    name: category.name  || '',
    type: category.type, 
    query: category.query, 
  })) || 
  (RuntimeConfig as any).custom_category?.map((category: any) => ({
    name: 'name' in category ? category.name  : '',
    type: category.type, 
    query: category.query, 
  })) || 
  ([] as Array<{ name: string; type: 'movie' | 'tv'; query: string }>);
  //------------修改后-------------
  */
  
  //-----新更改------
  let configFromDB = null;
 
// 判断是否应该尝试从数据库加载配置（避免在不支持的环境调用）
//if (
  //process.env.NEXT_PUBLIC_STORAGE_TYPE  === 'd1' ||
  //process.env.NEXT_PUBLIC_STORAGE_TYPE  === 'upstash'
//) {
  try {
     configFromDB = await getConfig();
  } catch (error) {
    console.warn('获取数据库值失败，改为使用环境变量:', error);
    // 失败时不阻断，降级使用环境变量
  }
//}
 
// 优先级：数据库 > 环境变量 > 默认值
const siteName =
  configFromDB?.SiteConfig?.SiteName ||
  process.env.SITE_NAME  ||
  'MoonTV';
 
const announcement =
  configFromDB?.SiteConfig?.Announcement ||
  process.env.ANNOUNCEMENT  ||
  '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';
 
const enableRegister =
  configFromDB?.UserConfig?.AllowRegister ??
  (process.env.NEXT_PUBLIC_ENABLE_REGISTER  === 'true');
 
const imageProxy =
  configFromDB?.SiteConfig?.ImageProxy ||
  process.env.NEXT_PUBLIC_IMAGE_PROXY  ||
  '';
 
const doubanProxy =
  configFromDB?.SiteConfig?.DoubanProxy ||
  process.env.NEXT_PUBLIC_DOUBAN_PROXY  ||
  '';
 
const disableYellowFilter =
  configFromDB?.SiteConfig?.DisableYellowFilter ??
  (process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER  === 'true');
 
const customCategories =
  configFromDB?.CustomCategories?.filter((c: any) => !c.disabled).map( 
    (category: any) => ({
      name: category.name  || '',
      type: category.type, 
      query: category.query, 
    })
  ) ||
  (RuntimeConfig as any)?.custom_category?.map((category: any) => ({
    name: 'name' in category ? category.name  : '',
    type: category.type, 
    query: category.query, 
  })) ||
  [];
  //-----新更改------
  
  
  // 将运行时配置注入到全局 window 对象，供客户端在运行时读取
  const runtimeConfig = {
    STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    ENABLE_REGISTER: enableRegister,
    IMAGE_PROXY: imageProxy,
    DOUBAN_PROXY: doubanProxy,
    DISABLE_YELLOW_FILTER: disableYellowFilter,
    CUSTOM_CATEGORIES: customCategories,
  };

  return (
    <html lang='zh-CN' suppressHydrationWarning>
      <head>
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1.0, viewport-fit=cover'
        />
        {/* 将配置序列化后直接写入脚本，浏览器端可通过 window.RUNTIME_CONFIG 获取 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-white text-gray-900 dark:bg-black dark:text-gray-200`}
      >
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <SiteProvider siteName={siteName} announcement={announcement}>
            {children}
            <GlobalErrorIndicator />
          </SiteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
