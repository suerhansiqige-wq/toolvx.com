import type { OfdSeoRichMessages } from "@/i18n/seo-rich/ofd-attach";

export type OfdMetaZh = {
  title: string;
  description: string;
};

/** Chinese TDK overrides for OFD tool pages (≤160 char descriptions). */
export const ofdMetaZh: Record<string, OfdMetaZh> = {
  "ofd-to-pdf": {
    title: "在线免费 OFD 转 PDF 工具 - 批量高效转换 | ToolVX",
    description:
      "免费在线 OFD 转 PDF，高保真导出。纯浏览器本地处理，无需上传服务器，发票与公文隐私安全。",
  },
  "ofd-merge": {
    title: "在线免费 OFD 合并工具 - 多文件合成 | ToolVX",
    description: "浏览器本地合并多个 OFD 文件为一个包，不上传服务器，适合电子发票批量归档。",
  },
  "ofd-to-image": {
    title: "OFD 转图片 PNG 在线工具 - 免费本地导出 | ToolVX",
    description: "将 OFD 每页导出为 PNG 图片 ZIP。100% 前端处理，保护发票与证件隐私。",
  },
  "ofd-to-long-image": {
    title: "OFD 转长图在线工具 - 多页拼接一张图 | ToolVX",
    description: "把 OFD 全部页面纵向拼成一张长图 PNG。本地转换，文件不上传云端。",
  },
  "ofd-to-svg": {
    title: "OFD 转 SVG 矢量导出 - 免费在线 | ToolVX",
    description: "导出 OFD 页面为 SVG 矢量文件。浏览器本地处理，公文数据更安全。",
  },
  "ofd-to-web": {
    title: "OFD 转 HTML 网页 - 离线预览导出 | ToolVX",
    description: "生成可离线打开的 HTML 快照。纯前端转换，无需上传 OFD 到服务器。",
  },
  "ofd-to-text": {
    title: "OFD 转文本在线提取 - 免费本地 | ToolVX",
    description: "从 OFD 提取纯文本为 TXT。本地 XML 解析，发票内容不上传。",
  },
  "ofd-compress": {
    title: "OFD 压缩在线工具 - 减小体积 | ToolVX",
    description: "本地 DEFLATE 压缩 OFD 包体积。免费、安全，文件不离开您的浏览器。",
  },
  "ofd-reader": {
    title: "OFD 阅读器在线 - 导出 PDF 免费 | ToolVX",
    description: "浏览器打开 OFD 并导出 PDF。无需安装客户端，100% 本地隐私处理。",
  },
};

/** Chinese SEO body copy for OFD tools (browser i18n). */
export const ofdSeoRichZh: Record<string, OfdSeoRichMessages> = {
  ofdToPdf: {
    whatIsHeading: "什么是 OFD 转 PDF？",
    whatIs:
      "OFD 转 PDF 工具可将开放式版式文档（OFD）——广泛用于中国电子发票、财政票据和公文——转换为标准 PDF，方便用 Adobe Reader 打开、打印、邮件发送或归档。",
    scenarios: [
      "增值税电子发票与财政电子票据",
      "政府机关、企事业单位下发的 OFD 公文",
      "将 OFD 归档为通用 PDF 格式",
      "分享给仅安装 PDF 阅读器的同事",
    ],
    steps: [
      "打开本页，点击上传区域或拖拽 .ofd 文件。",
      "等待状态提示「文件已上传」。",
      "点击「转换」，在本地渲染页面并生成 PDF。",
      "立即下载 PDF — 无需注册，不上传云端。",
    ],
    whyChoose:
      "所有 OFD 解析均在浏览器本地完成，发票、合同、证件数据绝不会上传到任何服务器，100% 保护隐私。",
    whyChoosePoints: [
      "零服务器上传 — 敏感发票数据始终留在您的电脑",
      "支持常见 OFD 1.x 包，包括电子发票版式",
      "无需安装软件 — 支持 Chrome、Edge、Firefox、Safari",
      "免费导出，PDF 无水印",
    ],
    faqs: [
      {
        question: "在这里转换机密 OFD 发票安全吗？",
        answer:
          "安全。转换完全在浏览器内用客户端 JavaScript 完成，文件不会传输到我们的服务器，也不会存入云端。",
      },
      {
        question: "需要安装 OFD 阅读器吗？",
        answer: "不需要。在本页上传 .ofd 并下载 PDF 即可，无需插件或桌面 OFD 软件。",
      },
      {
        question: "PDF 会和原 OFD 一样吗？",
        answer:
          "我们按高分辨率栅格化每一页以保留版式、印章和图片。若 OFD 未内嵌字体，极少数文字可能略有差异。",
      },
      {
        question: "可以批量转换多个 OFD 吗？",
        answer:
          "本页每次处理一个文件。若需先合并多个 OFD，请使用「OFD 合并」工具，再转换为 PDF。",
      },
    ],
  },

  ofdMerge: {
    whatIsHeading: "什么是 OFD 合并？",
    whatIs:
      "OFD 合并工具将多个开放式版式文档打包为一个 .ofd 文件（含多个文档体），适合将多张发票或分批发来的表单合并归档。",
    scenarios: ["按月合并电子发票", "合并合同附件", "打包多部分政务申报材料"],
    steps: [
      "一次选中至少 2 个 .ofd 文件（文件对话框中 Ctrl/Shift 多选）。",
      "等待合并完成，页面会出现下载链接。",
      "需要时可再次点击「合并」重新下载。",
      "用 OFD 阅读器打开，或再转为 PDF。",
    ],
    whyChoose:
      "合并在本地完成，文档内容不经网络传输；发票与公文数据 100% 留在您的设备。",
    whyChoosePoints: [
      "本地 zip 级合并，不上传服务器",
      "保留每个源文档为独立 Doc 体",
      "免费，个人与商业均可使用",
    ],
    faqs: [
      {
        question: "可以合并多少个文件？",
        answer: "一次可合并两个及以上文件，建议上传时一次选齐所有文件。",
      },
      {
        question: "合并后电子签章还有效吗？",
        answer: "签章结构会复制，但是否有效取决于阅读器与原始签章策略，法务场景请自行核验。",
      },
      {
        question: "合并失败怎么办？",
        answer: "请确认每个文件均为有效 .ofd 压缩包；部分导出工具目录名不标准时可尝试在原软件中重新导出。",
      },
      { question: "文件会上传吗？", answer: "不会，仅在浏览器内操作 zip 结构。" },
    ],
  },

  ofdToImage: {
    whatIsHeading: "什么是 OFD 转图片？",
    whatIs: "将 OFD 每一页导出为高清 PNG 图片并打包为 ZIP，便于微信分享、缩略图或插入其他应用。",
    scenarios: ["分享发票截图", "文档系统预览图", "证件、表单页面导出为图片"],
    steps: ["上传 .ofd 文件。", "点击「转换」导出 PNG。", "下载含 page-1.png 等的 ZIP。"],
    whyChoose: "整页栅格化保留印章与照片；发票证件数据不上传服务器。",
    whyChoosePoints: ["完整页面导出", "隐私本地处理", "PNG 无损画质"],
    faqs: [
      { question: "什么格式？", answer: "ZIP 内为 PNG 文件。" },
      {
        question: "文字缺失？",
        answer: "部分 OFD 依赖内嵌字体，可尝试桌面阅读器或确保源文件内嵌字体。",
      },
      { question: "页数限制？", answer: "取决于您设备的 CPU 与内存。" },
      { question: "能导出 JPG 吗？", answer: "本工具导出 PNG；可先转 PDF 再转 JPG。" },
    ],
  },

  ofdToLongImage: {
    whatIsHeading: "什么是 OFD 转长图？",
    whatIs: "将所有 OFD 页面纵向拼接为一张长 PNG，适合手机浏览与社交分享。",
    scenarios: ["证书/发票一图分享", "聊天软件滚动预览", "多页快照归档"],
    steps: ["上传 .ofd。", "点击「转换」拼接长图。", "下载单张 PNG。"],
    whyChoose: "自动纵向拼接；本地处理不上传。",
    whyChoosePoints: ["自动对齐宽度", "无第三方图床", "一键下载"],
    faqs: [
      { question: "页面如何排列？", answer: "按文档顺序自上而下，页间留小间距。" },
      { question: "分辨率？", answer: "跟随 OFD 渲染宽度，兼顾屏幕与打印。" },
      { question: "能再编辑吗？", answer: "输出为标准 PNG，可用任意修图软件编辑。" },
      { question: "会上传吗？", answer: "不会，均在浏览器完成。" },
    ],
  },

  ofdToSvg: {
    whatIsHeading: "什么是 OFD 转 SVG？",
    whatIs: "在支持时导出矢量 SVG，便于设计稿或网页嵌入。",
    scenarios: ["设计团队需要矢量素材", "网页嵌入图形", "技术归档"],
    steps: ["上传 OFD。", "点击「转换」。", "下载 SVG ZIP。"],
    whyChoose: "矢量可缩放；本地导出保护机密矢量数据。",
    whyChoosePoints: ["线条图清晰", "数据不出设备", "免装桌面 OFD"],
    faqs: [
      { question: "都能转 SVG？", answer: "取决于页面是否含矢量对象，纯扫描页可能较少。" },
      { question: "文字可编辑？", answer: "取决于 OFD 中文本编码方式。" },
      { question: "安全吗？", answer: "文件不离开浏览器。" },
      { question: "ZIP 里有什么？", answer: "每页一个 .svg 文件。" },
    ],
  },

  ofdToWeb: {
    whatIsHeading: "什么是 OFD 转网页？",
    whatIs: "生成含嵌入图片的独立 HTML，任何浏览器均可离线打开，无需 OFD 阅读器。",
    scenarios: ["内网静态分发", "邮件附件", "非技术人员快速预览"],
    steps: ["上传 OFD。", "点击「转换」。", "下载并用浏览器打开 .html。"],
    whyChoose: "单文件易分享；不在服务器渲染您的文档。",
    whyChoosePoints: ["单 HTML 离线可用", "无云端渲染", "U 盘/邮件即可传递"],
    faqs: [
      { question: "需要联网？", answer: "不需要，图片已内嵌。" },
      { question: "能放网站？", answer: "可上传到任意静态托管。" },
      { question: "会被搜索引擎收录？", answer: "仅当您公开发布时；我们不托管您的文件。" },
      { question: "交互保留吗？", answer: "导出为视觉快照，交互功能可能不保留。" },
    ],
  },

  ofdToText: {
    whatIsHeading: "什么是 OFD 转文本？",
    whatIs: "从 OFD 的 XML 结构提取纯文本为 .txt，便于搜索、引用或导入其他系统。",
    scenarios: ["复制发票号金额到表格", "内部检索", "引用合同条款"],
    steps: ["上传 OFD。", "上传后自动提取文本。", "点击「提取文本」下载 .txt。"],
    whyChoose: "快速 XML 提取，无需云端 OCR；财税数据留在本机。",
    whyChoosePoints: ["无需 OCR 云 API", "隐私友好", "视觉转换失败时的补充方案"],
    faqs: [
      { question: "保留版式吗？", answer: "不保留，仅为纯文本。" },
      {
        question: "为何有文字缺失？",
        answer: "纯图片或特殊编码的文字无法提取，请尝试转 PDF。",
      },
      { question: "扫描件？", answer: "纯扫描 OFD 无文本层，本工具不含 OCR。" },
      { question: "安全吗？", answer: "解析在浏览器本地完成。" },
    ],
  },

  ofdCompress: {
    whatIsHeading: "什么是 OFD 压缩？",
    whatIs: "用 DEFLATE 重新打包 .ofd，减小体积便于邮件与存储，不改变文档语义。",
    scenarios: ["邮件附件瘦身", "归档省空间", "合并/转换前优化"],
    steps: ["上传 OFD。", "自动压缩并出现下载链接。", "对比体积后保存。"],
    whyChoose: "本地重打包，发票内容不上传。",
    whyChoosePoints: ["结构无损", "一键下载", "免费"],
    faqs: [
      { question: "能小多少？", answer: "取决于原包是否已压缩。" },
      { question: "还合法吗？", answer: "内部 XML 与资源保留，仅 zip 压缩级别变化。" },
      { question: "签章？", answer: "结构保留，合规场景请在目标阅读器验证。" },
      { question: "安全？", answer: "全程浏览器内处理。" },
    ],
  },

  ofdReader: {
    whatIsHeading: "什么是 OFD 阅读器？",
    whatIs:
      "浏览器加载 OFD 并导出 PDF，无需安装国产 OFD 客户端即可查看电子发票与公文。",
    scenarios: ["任何系统打开 e-invoice", "快速 PDF 打印批注", "转发前核对内容"],
    steps: ["上传 OFD。", "点击「导出 PDF」。", "用 PDF 阅读器打开。"],
    whyChoose: "免插件；文档不离开本机。",
    whyChoosePoints: ["免装政府客户端", "本地处理", "免费 PDF 导出"],
    faqs: [
      {
        question: "能在网页里翻页吗？",
        answer: "本工具侧重安全导出；在线阅读请用转图片或导出 PDF。",
      },
      { question: "支持 OFD 1.1 发票？", answer: "常见 1.x 发票包支持，个别issuer可能例外。" },
      { question: "上传吗？", answer: "不上传，纯客户端。" },
      { question: "打印？", answer: "导出 PDF 后打印效果最佳。" },
    ],
  },
};
