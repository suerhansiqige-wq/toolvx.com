export type SeoBlockMessages =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean };

export type SeoSectionMessages = {
  heading: string;
  blocks: SeoBlockMessages[];
};

export type SeoFaqMessages = {
  question: string;
  answer: string;
};

export type SeoRichMessages = {
  h1: string;
  introduction: string;
  steps: string[];
  faqs: SeoFaqMessages[];
};

export type ToolMessages = {
  title: string;
  tagline: string;
  action: string;
  download: string;
  uploadHint: string;
  uploadSubhint: string;
  processing: string;
  success: string;
  error: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoSections: SeoSectionMessages[];
  seoRich?: SeoRichMessages;
};

export type UIStrings = {
  nav: {
    home: string;
    posts: string;
    tags: string;
    about: string;
    archives: string;
    search: string;
    tools: string;
    redact: string;
    ofdTools: string;
  };
  post: {
    publishedAt: string;
    updatedAt: string;
    sharePostIntro: string;
    sharePostOn: string;
    sharePostViaEmail: string;
    tagLabel: string;
    backToTop: string;
    goBack: string;
    editPage: string;
    previousPost: string;
    nextPost: string;
  };
  pagination: {
    prev: string;
    next: string;
    page: string;
  };
  home: {
    socialLinks: string;
    featured: string;
    recentPosts: string;
    allPosts: string;
    toolQuick: {
      ariaLabel: string;
      redact: string;
      redactDesc: string;
      pdf: string;
      pdfDesc: string;
      image: string;
      imageDesc: string;
      audio: string;
      audioDesc: string;
      ofd: string;
      ofdDesc: string;
      comingSoon: string;
    };
  };
  footer: {
    copyright: string;
    allRightsReserved: string;
  };
  pages: {
    tagTitle: string;
    tagDesc: string;
    tagsTitle: string;
    tagsDesc: string;
    postsTitle: string;
    postsDesc: string;
    archivesTitle: string;
    archivesDesc: string;
    searchTitle: string;
    searchDesc: string;
  };
  a11y: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    toggleTheme: string;
    searchPlaceholder: string;
    noResults: string;
    goToPreviousPage: string;
    goToNextPage: string;
  };
  notFound: {
    title: string;
    message: string;
    goHome: string;
  };
};

export type Messages = {
  site: {
    nav: {
      home: string;
      posts: string;
      tags: string;
      about: string;
      archives: string;
      search: string;
      tools: string;
      redact: string;
      ofdTools: string;
    };
    footer: {
      copyright: string;
      allRightsReserved: string;
    };
    a11y: {
      skipToContent: string;
      openMenu: string;
      closeMenu: string;
      toggleTheme: string;
      loading: string;
    };
    sidebar: {
      allTools: string;
      ariaLabel: string;
      sections: {
        compressConvert: string;
        organize: string;
        security: string;
      };
    };
  };
  blog: {
    nav: { home: string };
    post: {
      publishedAt: string;
      updatedAt: string;
      sharePostIntro: string;
      sharePostOn: string;
      sharePostViaEmail: string;
      tagLabel: string;
      backToTop: string;
      goBack: string;
      editPage: string;
      previousPost: string;
      nextPost: string;
    };
    pagination: { prev: string; next: string; page: string };
    home: {
      socialLinks: string;
      featured: string;
      recentPosts: string;
      allPosts: string;
      toolQuick: {
        ariaLabel: string;
        redact: string;
        redactDesc: string;
        pdf: string;
        pdfDesc: string;
        image: string;
        imageDesc: string;
        audio: string;
        audioDesc: string;
        ofd: string;
        ofdDesc: string;
        comingSoon: string;
      };
    };
    pages: {
      tagTitle: string;
      tagDesc: string;
      tagsTitle: string;
      tagsDesc: string;
      postsTitle: string;
      postsDesc: string;
      archivesTitle: string;
      archivesDesc: string;
      searchTitle: string;
      searchDesc: string;
      tagPageTitle: string;
      tagPageDesc: string;
    };
    notFound: { title: string; message: string; goHome: string };
    a11y: {
      searchPlaceholder: string;
      noResults: string;
      goToPreviousPage: string;
      goToNextPage: string;
      breadcrumb: string;
      paginationNav: string;
    };
    card: { readMore: string };
    hero: {
      title: string;
      description: string;
      readPostsPrefix: string;
      readme: string;
      readPostsSuffix: string;
      rssFeed: string;
    };
    search: { devWarning: string; devBuildCommand: string; clear: string };
    lightbox: {
      copy: string;
      copied: string;
      zoomImage: string;
      zoomImageAlt: string;
      imagePreview: string;
      imagePreviewAlt: string;
      closePreview: string;
    };
    socials: { emailTo: string; onPlatform: string };
    breadcrumb: { postsPage: string; tagPage: string };
    layout: {
      toolsSidebar: string;
      toolWorkspace: string;
      sidebarAd: string;
      toolActions: string;
    };
    ads: { placeholder: string; ariaLabel: string };
  };
  menu: {
    pdfTools: string;
    columns: Record<string, string>;
    tools: Record<string, string>;
  };
  common: {
    download: string;
    processing: string;
    success: string;
    error: string;
    selectFile: string;
    password: string;
    confirmPassword: string;
    pageNumbers: string;
    watermarkText: string;
    signatureText: string;
    rotation: string;
    splitAtPage: string;
    splitPages: string;
    splitPagesExample: string;
    pageNumberStartAt: string;
    pageNumberStartFrom: string;
    watermarkMode: string;
    watermarkTypeText: string;
    watermarkTypeImage: string;
    watermarkImage: string;
    cropMargin: string;
    metadataTitle: string;
    metadataAuthor: string;
    metadataSubject: string;
    compressionBalanced: string;
    compressionStrong: string;
    compressionMaximum: string;
    compressionLegend: string;
    prevPage: string;
    nextPage: string;
    pageOf: string;
    hubIntro: string;
    clickToReplace: string;
    clickToReplaceMultiple: string;
    splitMode: string;
    splitEveryPage: string;
    splitAtPageOption: string;
    pageNumbersExample: string;
    signaturePlaceholder: string;
    compressStats: string;
    needTwoFiles: string;
    passwordMismatch: string;
    compressionBalancedHint: string;
    compressionStrongHint: string;
    compressionMaximumHint: string;
    compressEach: string;
    compressMerge: string;
    watermarkDefault: string;
    signatureDefault: string;
    seoHowToHeading: string;
    seoFaqHeading: string;
  };
  tools: Record<string, ToolMessages>;
  ofd: {
    hub: {
      title: string;
      description: string;
      ariaLabel: string;
      localBadge: string;
    };
    tools: Record<string, { title: string; desc: string }>;
    workspace: {
      sidebarAria: string;
      uploadHint: string;
      uploadSubhint: string;
      uploadMultiHint: string;
      previewAria: string;
      processing: string;
      success: string;
      fileReady: string;
      error: string;
      errorInvalid: string;
      errorNeedMultiple: string;
      errorMergeFailed: string;
      errorNoVisual: string;
      errorNoText: string;
      fallbackImages: string;
      convert: string;
      download: string;
      actionMerge: string;
      actionCompress: string;
      actionExtract: string;
      actionView: string;
      readerReady: string;
      trustTitle: string;
      trustSub: string;
      trustCheck1: string;
      trustCheck2: string;
      trustCheck3: string;
    };
  };
};
