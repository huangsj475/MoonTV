import { API_CONFIG, ApiSite, getConfig } from '@/lib/config';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}
   //新增：Unicode解码函数
const decodeUnicodeIfNeeded = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && value.includes('\\u')) {
    try {
      return JSON.parse(`"${value}"`);
    } catch {
      // 备用解码方法
      return value.replace(/\\u([\d\w]{4})/gi, (match, grp) => 
        String.fromCharCode(parseInt(grp, 16))
      );
    }
  }
  return value;
};
export async function searchFromApi(
  apiSite: ApiSite,
  query: string
): Promise<SearchResult[]> {
  try {
    const apiBaseUrl = apiSite.api;
    const apiUrl =
      apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
    const apiName = apiSite.name;

    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      return [];
    }
    // 处理第一页结果
    const results = data.list.map((item: ApiSearchItem) => {
      let episodes: string[] = [];

	  const decodedPlayUrl = decodeUnicodeIfNeeded(item.vod_play_url);
      // 使用正则表达式从 vod_play_url 提取 m3u8 链接
      if (decodedPlayUrl) {
        const m3u8Regex = /([^$#\n]+)\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
        // 先用 $$$ 分割
        const vod_play_url_array = decodedPlayUrl.split('$$$');
        // 对每个分片做匹配，取匹配到最多的作为结果
        vod_play_url_array.forEach((url: string) => {
          const matches = url.match(m3u8Regex) || [];
          if (matches.length > episodes.length) {
            episodes = matches;
          }
        });
      }

      episodes = Array.from(new Set(episodes)).map((link: string) => {
        //link = link.substring(1); // 去掉开头的 $
        //const parenIndex = link.indexOf('(');
        //return parenIndex > 0 ? link.substring(0, parenIndex) : link;
		return link.replace(/[-()【】]/g, ''); // 移除多种括号
      });

      const decodedYear = decodeUnicodeIfNeeded(item.vod_year);
      const decodedContent = decodeUnicodeIfNeeded(item.vod_content);
	  const decodedRemarks = decodeUnicodeIfNeeded(item.vod_remarks)?.replace(/[-()【】]/g, '') || ''; 
      return {
        id: String(decodeUnicodeIfNeeded(item.vod_id)),
        title: decodeUnicodeIfNeeded(item.vod_name).trim().replace(/\s+/g, ' '),
        poster: decodeUnicodeIfNeeded(item.vod_pic),
        episodes,
        source: apiSite.key,
        source_name: apiName,
        class: decodeUnicodeIfNeeded(item.vod_class),
        year: decodedYear
          ? String(decodedYear).match(/\d{4}/)?.[0] || ''
          : 'unknown',
        desc: cleanHtmlTags(decodedContent || ''),
        type_name: decodeUnicodeIfNeeded(item.type_name),
        douban_id: item.vod_douban_id,
		remarks: decodedRemarks || '',
      };
    });

    const config = await getConfig();
    const MAX_SEARCH_PAGES: number = config.SiteConfig.SearchDownstreamMaxPage;

    // 获取总页数
    const pageCount = data.pagecount || 1;
    // 确定需要获取的额外页数
    const pagesToFetch = Math.min(pageCount - 1, MAX_SEARCH_PAGES - 1);

    // 如果有额外页数，获取更多页的结果
    if (pagesToFetch > 0) {
      const additionalPagePromises = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        const pageUrl =
          apiBaseUrl +
          API_CONFIG.search.pagePath
            .replace('{query}', encodeURIComponent(query))
            .replace('{page}', page.toString());

        const pagePromise = (async () => {
          try {
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(
              () => pageController.abort(),
              8000
            );

            const pageResponse = await fetch(pageUrl, {
              headers: API_CONFIG.search.headers,
              signal: pageController.signal,
            });

            clearTimeout(pageTimeoutId);

            if (!pageResponse.ok) return [];

            const pageData = await pageResponse.json();

            if (!pageData || !pageData.list || !Array.isArray(pageData.list))
              return [];

            return pageData.list.map((item: ApiSearchItem) => {
              let episodes: string[] = [];

			  const decodedPlayUrl = decodeUnicodeIfNeeded(item.vod_play_url);
              // 使用正则表达式从 vod_play_url 提取 m3u8 链接
              if (decodedPlayUrl) {
                const m3u8Regex = /([^$#\n]+)\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
                episodes = decodedPlayUrl.match(m3u8Regex) || [];
              }

              episodes = Array.from(new Set(episodes)).map((link: string) => {
                //link = link.substring(1); // 去掉开头的 $
                //const parenIndex = link.indexOf('(');
                //return parenIndex > 0 ? link.substring(0, parenIndex) : link;
				return link.replace(/[-()【】]/g, ''); // 移除多种括号
              });

              const decodedYear = decodeUnicodeIfNeeded(item.vod_year);
              const decodedContent = decodeUnicodeIfNeeded(item.vod_content);
			  const decodedRemarks = decodeUnicodeIfNeeded(item.vod_remarks)?.replace(/[-()【】]/g, '') || ''; 
              return {
                id: String(decodeUnicodeIfNeeded(item.vod_id)),
                title: decodeUnicodeIfNeeded(item.vod_name).trim().replace(/\s+/g, ' '),
                poster: decodeUnicodeIfNeeded(item.vod_pic),
                episodes,
                source: apiSite.key,
                source_name: apiName,
                class: decodeUnicodeIfNeeded(item.vod_class),
                year: decodedYear
                  ? String(decodedYear).match(/\d{4}/)?.[0] || ''
                  : 'unknown',
                desc: cleanHtmlTags(decodedContent || ''),
                type_name: decodeUnicodeIfNeeded(item.type_name),
                douban_id: item.vod_douban_id,
				remarks: decodedRemarks || '',
              };
            });
          } catch (error) {
            return [];
          }
        })();

        additionalPagePromises.push(pagePromise);
      }

      // 等待所有额外页的结果
      const additionalResults = await Promise.all(additionalPagePromises);

      // 合并所有页的结果
      additionalResults.forEach((pageResults) => {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      });
    }

    return results;
  } catch (error) {
    return [];
  }
}

// 匹配 m3u8 链接的正则
const M3U8_PATTERN = /([^$#\n]+)\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
          
export async function getDetailFromApi(
  apiSite: ApiSite,
  id: string
): Promise<SearchResult> {
  if (apiSite.detail) {
    return handleSpecialSourceDetail(id, apiSite);
  }

  const detailUrl = `${apiSite.api}${API_CONFIG.detail.path}${id}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (
    !data ||
    !data.list ||
    !Array.isArray(data.list) ||
    data.list.length === 0
  ) {
    throw new Error('获取到的详情内容无效');
  }

  const videoDetail = data.list[0];
  let episodes: string[] = [];
  
  const decodedPlayUrl = decodeUnicodeIfNeeded(videoDetail.vod_play_url);
  const decodedContent = decodeUnicodeIfNeeded(videoDetail.vod_content);
  const decodedYear = decodeUnicodeIfNeeded(videoDetail.vod_year);

  // 处理播放源拆分
  if (decodedPlayUrl) {
    const playSources = decodedPlayUrl.split('$$$');
    if (playSources.length > 0) {
      const mainSource = playSources[0];
      const episodeList = mainSource.split('#');
      episodes = episodeList;
    }
  }

  // 如果播放源为空，则尝试从内容中解析 m3u8
  if (episodes.length === 0 && decodedContent) {
    const matches = decodedContent.match(M3U8_PATTERN) || [];
    //episodes = matches.map((link: string) => link.replace(/^\$/, ''));
    episodes = matches;
  }

  return {
    id: String(id),
    title: decodeUnicodeIfNeeded(videoDetail.vod_name),
    poster: decodeUnicodeIfNeeded(videoDetail.vod_pic),
    episodes,
    source: apiSite.key,
    source_name: apiSite.name,
    class: decodeUnicodeIfNeeded(videoDetail.vod_class),
    year: decodedYear
      ? String(decodedYear).match(/\d{4}/)?.[0] || ''
      : 'unknown',
    desc: cleanHtmlTags(decodedContent),
    type_name: decodeUnicodeIfNeeded(videoDetail.type_name),
    douban_id: videoDetail.vod_douban_id,
	remarks: decodeUnicodeIfNeeded(videoDetail.vod_remarks) || '',
  };
}

async function handleSpecialSourceDetail(
  id: string,
  apiSite: ApiSite
): Promise<SearchResult> {
  const detailUrl = `${apiSite.detail}/index.php/vod/detail/id/${id}.html`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情页请求失败: ${response.status}`);
  }

  const html = await response.text();
  let matches: string[] = [];

  if (apiSite.key === 'ffzy') {
    const ffzyPattern =
      /([^$#\n]+)\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
    matches = html.match(ffzyPattern) || [];
  }

  if (matches.length === 0) {
    const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
    matches = html.match(generalPattern) || [];
  }

  // 去重并清理链接前缀
  matches = Array.from(new Set(matches)).map((link: string) => {
    //link = link.substring(1); // 去掉开头的 $
    //const parenIndex = link.indexOf('(');
    //return parenIndex > 0 ? link.substring(0, parenIndex) : link;
	return link.replace(/[-()【】]/g, ''); // 移除多种括号
  });

  // 提取标题
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const titleText = titleMatch ? titleMatch[1].trim() : '';

  // 提取描述
  const descMatch = html.match(
    /<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/
  );
  const descText = descMatch ? cleanHtmlTags(descMatch[1]) : '';

  // 提取封面
  const coverMatch = html.match(/(https?:\/\/[^"'\s]+?\.jpg)/g);
  const coverUrl = coverMatch ? coverMatch[0].trim() : '';

  // 提取年份
  const yearMatch = html.match(/>(\d{4})</);
  const yearText = yearMatch ? yearMatch[1] : 'unknown';

  return {
    id,
    title: titleText,
    poster: coverUrl,
    episodes: matches,
    source: apiSite.key,
    source_name: apiSite.name,
    class: '',
    year: yearText,
    desc: descText,
    type_name: '',
    douban_id: 0,
  };
}
