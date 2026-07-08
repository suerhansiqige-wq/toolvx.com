import type { Messages } from "@/i18n/types";

export const blogEn: Messages["blog"] = {
  nav: {
    home: "Home",
  },
  post: {
    publishedAt: "Published on",
    updatedAt: "Updated",
    sharePostIntro: "Share this post:",
    sharePostOn: "Share this post on {platform}",
    sharePostViaEmail: "Share this post via email",
    tagLabel: "Tags",
    backToTop: "Back to top",
    goBack: "Go back",
    editPage: "Edit page",
    previousPost: "Previous Post",
    nextPost: "Next Post",
  },
  pagination: {
    prev: "Prev",
    next: "Next",
    page: "Page",
  },
  home: {
    socialLinks: "Social Links",
    featured: "Featured",
    recentPosts: "Recent Posts",
    allPosts: "All Posts",
  },
  pages: {
    tagTitle: "Tag",
    tagDesc: "All the articles with the tag",
    tagsTitle: "Tags",
    tagsDesc: "All the tags used in posts.",
    postsTitle: "Posts",
    postsDesc: "All the articles I've posted.",
    archivesTitle: "Archives",
    archivesDesc: "All the articles I've archived.",
    searchTitle: "Search",
    searchDesc: "Search for anything...",
    tagPageTitle: "Tag: {tag}",
    tagPageDesc: 'All the articles with the tag "{tag}".',
  },
  notFound: {
    title: "404 Not Found",
    message: "Page Not Found",
    goHome: "Go back home",
  },
  a11y: {
    searchPlaceholder: "Search for anything...",
    noResults: "No results found",
    goToPreviousPage: "Go to previous page",
    goToNextPage: "Go to next page",
    breadcrumb: "breadcrumb",
    paginationNav: "Pagination Navigation",
  },
  card: {
    readMore: "Read more →",
  },
  hero: {
    title: "Mingalaba",
    description:
      "AstroPaper is a minimal, responsive, accessible and SEO-friendly Astro blog theme. This theme follows best practices and provides accessibility out of the box. Light and dark mode are supported by default. Moreover, additional color schemes can also be configured.",
    readPostsPrefix: "Read the blog posts or check",
    readme: "README",
    readPostsSuffix: "for more info.",
    rssFeed: "RSS Feed",
  },
  search: {
    devWarning:
      "DEV mode Warning! You need to build the project at least once to see the search results during development.",
    devBuildCommand: "npm run build",
    clear: "Clear",
  },
  lightbox: {
    copy: "Copy",
    copied: "Copied",
    zoomImage: "Zoom image",
    zoomImageAlt: "Zoom image: {alt}",
    imagePreview: "Image preview",
    imagePreviewAlt: "Image preview: {alt}",
    closePreview: "Close image preview",
  },
  socials: {
    emailTo: "Send an email to {site}",
    onPlatform: "{site} on {platform}",
  },
  breadcrumb: {
    postsPage: "Posts (page {page})",
    tagPage: "{tag} (page {page})",
  },
  layout: {
    toolsSidebar: "Tools sidebar",
    toolWorkspace: "Tool workspace",
    sidebarAd: "Sidebar advertisement",
    toolActions: "Tool actions",
  },
  ads: {
    placeholder: "ADVERTISEMENT PLACEHOLDER",
    ariaLabel: "Advertisement placeholder",
  },
};

export const blogZh: Messages["blog"] = {
  nav: {
    home: "首页",
  },
  post: {
    publishedAt: "发布于",
    updatedAt: "更新",
    sharePostIntro: "分享这篇文章：",
    sharePostOn: "在 {platform} 上分享",
    sharePostViaEmail: "通过邮件分享",
    tagLabel: "标签",
    backToTop: "回到顶部",
    goBack: "返回",
    editPage: "编辑页面",
    previousPost: "上一篇",
    nextPost: "下一篇",
  },
  pagination: {
    prev: "上一页",
    next: "下一页",
    page: "第",
  },
  home: {
    socialLinks: "社交链接",
    featured: "精选",
    recentPosts: "最新文章",
    allPosts: "全部文章",
  },
  pages: {
    tagTitle: "标签",
    tagDesc: "包含该标签的所有文章",
    tagsTitle: "标签",
    tagsDesc: "文章中使用的所有标签。",
    postsTitle: "文章",
    postsDesc: "我发布的所有文章。",
    archivesTitle: "归档",
    archivesDesc: "我归档的所有文章。",
    searchTitle: "搜索",
    searchDesc: "搜索任意内容…",
    tagPageTitle: "标签：{tag}",
    tagPageDesc: "包含标签「{tag}」的所有文章。",
  },
  notFound: {
    title: "404 未找到",
    message: "页面未找到",
    goHome: "返回首页",
  },
  a11y: {
    searchPlaceholder: "搜索任意内容…",
    noResults: "未找到结果",
    goToPreviousPage: "转到上一页",
    goToNextPage: "转到下一页",
    breadcrumb: "面包屑导航",
    paginationNav: "分页导航",
  },
  card: {
    readMore: "阅读更多 →",
  },
  hero: {
    title: "Mingalaba",
    description:
      "AstroPaper 是一款极简、响应式、无障碍且 SEO 友好的 Astro 博客主题。遵循最佳实践，开箱即用支持无障碍访问。默认支持浅色与深色模式，还可配置更多配色方案。",
    readPostsPrefix: "阅读博客文章或查看",
    readme: "README",
    readPostsSuffix: "了解更多。",
    rssFeed: "RSS 订阅",
  },
  search: {
    devWarning: "开发模式提示：需要至少构建一次项目才能在开发环境中看到搜索结果。",
    devBuildCommand: "npm run build",
    clear: "清除",
  },
  lightbox: {
    copy: "复制",
    copied: "已复制",
    zoomImage: "放大图片",
    zoomImageAlt: "放大图片：{alt}",
    imagePreview: "图片预览",
    imagePreviewAlt: "图片预览：{alt}",
    closePreview: "关闭图片预览",
  },
  socials: {
    emailTo: "发送邮件至 {site}",
    onPlatform: "{site} 的 {platform}",
  },
  breadcrumb: {
    postsPage: "文章（第 {page} 页）",
    tagPage: "{tag}（第 {page} 页）",
  },
  layout: {
    toolsSidebar: "工具侧边栏",
    toolWorkspace: "工具工作区",
    sidebarAd: "侧边栏广告",
    toolActions: "工具操作",
  },
  ads: {
    placeholder: "广告占位符",
    ariaLabel: "广告占位区域",
  },
};
