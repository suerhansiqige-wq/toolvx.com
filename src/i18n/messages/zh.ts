import type { Messages } from "@/i18n/types";
import { blogZh } from "./blog";
import { ofdZh } from "./ofd";
import { attachSeoRich } from "@/i18n/seo-rich/attach";
import { seoRichZh } from "@/i18n/seo-rich/zh";

const pdfUpload = "点击上传或拖拽 PDF 文件到此处";
const pdfSubhint = "支持单个 PDF 文件";
const pdfMulti = "点击上传或拖拽多个 PDF 文件到此处";
const pdfMultiSub = "选择多个 PDF 文件进行合并";
const imageUpload = "点击上传或拖拽图片文件到此处";
const imageSub = "支持 JPG、PNG 和 WebP 图片";
const redactUpload = "将图片或 PDF 拖放到此处，或点击浏览";
const redactSubhint = "支持 JPG、PNG、GIF、WebP 及多页 PDF";

function tool(
  title: string,
  tagline: string,
  action: string,
  download: string,
  uploadHint: string,
  uploadSubhint: string,
  seoTitle: string,
  seoDescription: string,
  seoKeywords: string,
  seoSections: Messages["tools"][string]["seoSections"]
): Messages["tools"][string] {
  return {
    title,
    tagline,
    action,
    download,
    uploadHint,
    uploadSubhint,
    processing: "处理中…",
    success: "完成！文件已准备好。",
    error: "无法处理此文件，请尝试其他文件。",
    seoTitle,
    seoDescription,
    seoKeywords,
    seoSections,
  };
}

export const zh: Messages = {
  site: {
    nav: {
      home: "首页",
      posts: "文章",
      tags: "标签",
      about: "关于",
      archives: "归档",
      search: "搜索",
      tools: "PDF工具",
      redact: "脱敏",
      ofdTools: "OFD工具",
    },
    footer: {
      copyright: "版权",
      allRightsReserved: "保留所有权利。",
    },
    a11y: {
      skipToContent: "跳转到内容",
      openMenu: "打开菜单",
      closeMenu: "关闭菜单",
      toggleTheme: "切换主题",
      loading: "加载中…",
    },
    sidebar: {
      allTools: "全部工具",
      ariaLabel: "PDF 工具导航",
      sections: {
        compressConvert: "压缩与转换",
        organize: "整理",
        security: "安全",
      },
    },
  },
  blog: blogZh,
  menu: {
    pdfTools: "PDF 工具",
    columns: {
      compressConvert: "压缩与转换",
      organize: "整理",
      viewEdit: "查看与编辑",
      convertFromPdf: "从 PDF 转换",
      convertToPdf: "转换为 PDF",
      securitySign: "安全与签名",
    },
    tools: {
      compressPdf: "压缩 PDF",
      mergePdf: "合并 PDF",
      splitPdf: "拆分 PDF",
      rotatePdf: "旋转 PDF",
      deletePdfPages: "删除 PDF 页面",
      editPdf: "编辑 PDF",
      pdfReader: "PDF 阅读器",
      numberPages: "添加页码",
      cropPdf: "裁剪 PDF",
      watermarkPdf: "PDF 水印",
      pdfToJpg: "PDF 转 JPG",
      jpgToPdf: "JPG 转 PDF",
      signPdf: "签署 PDF",
      unlockPdf: "解锁 PDF",
      protectPdf: "保护 PDF",
      redactImagePdf: "图片与 PDF 脱敏",
    },
  },
  common: {
    download: "下载",
    processing: "处理中…",
    success: "完成！文件已准备好。",
    error: "出现错误。",
    selectFile: "请先选择文件。",
    password: "密码",
    confirmPassword: "确认密码",
    pageNumbers: "要删除的页码（如 1,3,5-7）",
    watermarkText: "水印文字",
    signatureText: "签名文字",
    rotation: "旋转角度",
    splitAtPage: "在第几页后拆分",
    splitPages: "输入要拆分的页码",
    splitPagesExample: "1, 2, 3",
    pageNumberStartAt: "从第几页开始编号",
    pageNumberStartFrom: "起始页码",
    watermarkMode: "水印类型",
    watermarkTypeText: "文字水印",
    watermarkTypeImage: "图片水印",
    watermarkImage: "水印图片",
    cropMargin: "裁剪边距 (%)",
    metadataTitle: "文档标题",
    metadataAuthor: "作者",
    metadataSubject: "主题",
    compressionLegend: "压缩级别",
    compressionBalanced: "均衡",
    compressionStrong: "强力",
    compressionMaximum: "最大",
    compressionBalancedHint: "高清输出",
    compressionStrongHint: "控制在 2MB 以内",
    compressionMaximumHint: "控制在 1MB 以内",
    compressEach: "单独压缩",
    compressMerge: "合并压缩",
    watermarkDefault: "机密",
    signatureDefault: "已签署",
    prevPage: "上一页",
    nextPage: "下一页",
    pageOf: "第 {current} 页，共 {total} 页",
    hubIntro: "选择下方转换工具 — 所有处理均在浏览器本地完成。",
    clickToReplace: "点击更换文件",
    clickToReplaceMultiple: "点击更换文件",
    splitMode: "拆分模式",
    splitEveryPage: "每页单独文件 (ZIP)",
    splitAtPageOption: "指定页码",
    pageNumbersExample: "1,3,5-7",
    signaturePlaceholder: "您的姓名",
    compressStats: "{orig} → {out}（缩小 {pct}%）",
    needTwoFiles: "至少需要 2 个文件",
    passwordMismatch: "两次密码不一致",
    seoHowToHeading: "使用步骤",
    seoFaqHeading: "常见问题",
  },
  tools: attachSeoRich(
    {
    compressPdf: tool(
      "压缩 PDF",
      "几秒钟内减小 PDF 文件大小 — 可上传多个 PDF，默认压缩或按目标大小压缩。",
      "默认压缩",
      "下载压缩后的 PDF",
      pdfMulti,
      "选择一个或多个 PDF — 可单独压缩或先合并再压缩",
      "免费在线压缩 PDF | 减小 PDF 文件大小",
      "免费在线压缩 PDF 文件。几秒钟内缩小大型 PDF，便于邮件和网页分享。",
      "压缩 pdf, pdf 压缩, 减小 pdf 大小",
      [
        {
          heading: "为什么要压缩 PDF？",
          blocks: [
            {
              type: "paragraph",
              text: "大型 PDF 会拖慢邮件发送和网页加载。压缩可在保持可读性的同时减小文件大小。",
            },
          ],
        },
        {
          heading: "如何压缩 PDF",
          blocks: [
            {
              type: "list",
              ordered: true,
              items: [
                "上传一个或多个 PDF 文件。",
                "点击「默认压缩」（输出不会大于原文件），或填写 MB 上限后点击「压缩到目标大小」。",
                "可压缩单个文件、分别压缩（ZIP）或合并后压缩。",
              ],
            },
          ],
        },
      ]
    ),
    mergePdf: tool(
      "合并 PDF",
      "将多个 PDF 文件按顺序合并为一个文档。",
      "合并 PDF",
      "下载合并后的 PDF",
      pdfMulti,
      pdfMultiSub,
      "免费在线合并 PDF",
      "免费在线将多个 PDF 合并为一个文档。快速、简单、安全。",
      "合并 pdf, 合并 pdf 文件",
      [
        {
          heading: "如何合并 PDF",
          blocks: [
            {
              type: "list",
              ordered: true,
              items: ["上传两个或更多 PDF 文件。", "点击合并 PDF。", "下载合并后的文档。"],
            },
          ],
        },
      ]
    ),
    splitPdf: tool(
      "拆分 PDF",
      "将 PDF 拆分为单独文件 — 每页一个或在指定页拆分。",
      "拆分 PDF",
      "下载拆分文件",
      pdfUpload,
      pdfSubhint,
      "免费在线拆分 PDF",
      "将 PDF 拆分为单页或范围。免费在线 PDF 拆分工具。",
      "拆分 pdf, 分离 pdf 页面",
      [
        {
          heading: "拆分选项",
          blocks: [
            {
              type: "paragraph",
              text: "将每页拆分为独立 PDF（ZIP 下载），或在指定页码处拆分为两个文件。",
            },
          ],
        },
      ]
    ),
    rotatePdf: tool(
      "旋转 PDF",
      "将 PDF 所有页面旋转 90°、180° 或 270°。",
      "旋转 PDF",
      "下载旋转后的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线旋转 PDF",
      "免费在线旋转 PDF 页面。几秒钟内修正扫描方向。",
      "旋转 pdf, 转动 pdf 页面",
      [
        {
          heading: "如何旋转 PDF",
          blocks: [
            {
              type: "list",
              ordered: true,
              items: ["上传 PDF。", "选择旋转角度。", "下载旋转后的文件。"],
            },
          ],
        },
      ]
    ),
    deletePdfPages: tool(
      "删除 PDF 页面",
      "从 PDF 文档中移除不需要的页面。",
      "删除页面",
      "下载更新后的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线删除 PDF 页面",
      "免费在线从 PDF 中删除页面。输入页码或范围。",
      "删除 pdf 页面",
      [
        {
          heading: "页码格式",
          blocks: [
            {
              type: "paragraph",
              text: "用逗号分隔页码，或使用范围如 5-8。示例：1,3,5-7",
            },
          ],
        },
      ]
    ),
    editPdf: tool(
      "编辑 PDF",
      "更新 PDF 文档属性，如标题、作者和主题。",
      "保存元数据",
      "下载更新后的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线编辑 PDF 元数据",
      "免费在线编辑 PDF 标题、作者和主题元数据。",
      "编辑 pdf 元数据",
      [
        {
          heading: "可编辑内容",
          blocks: [
            {
              type: "paragraph",
              text: "此工具更新文档元数据（标题、作者、主题）。视觉编辑请使用桌面 PDF 编辑器。",
            },
          ],
        },
      ]
    ),
    pdfReader: tool(
      "PDF 阅读器",
      "直接在浏览器中查看 PDF — 无需下载。",
      "打开 PDF",
      "下载 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线 PDF 阅读器",
      "免费在线阅读和预览 PDF 文件。在浏览器中即时翻页。",
      "pdf 阅读器, 在线查看 pdf",
      [
        {
          heading: "私密 PDF 查看",
          blocks: [
            {
              type: "paragraph",
              text: "文件保留在您的设备上。使用页面控件浏览文档。",
            },
          ],
        },
      ]
    ),
    numberPages: tool(
      "添加页码",
      "为 PDF 每一页添加页码。",
      "添加页码",
      "下载带页码的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线为 PDF 添加页码",
      "免费在线为 PDF 文档添加页码。",
      "pdf 页码",
      [
        {
          heading: "自动编号",
          blocks: [
            {
              type: "paragraph",
              text: "可设置从 PDF 第几页开始编号，以及起始页码数字；上传后可横排预览各页。",
            },
          ],
        },
      ]
    ),
    cropPdf: tool(
      "裁剪 PDF",
      "裁剪 PDF 每一页的边距。",
      "裁剪 PDF",
      "下载裁剪后的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线裁剪 PDF",
      "免费在线裁剪 PDF 边距。去除扫描文档的白边。",
      "裁剪 pdf",
      [
        {
          heading: "边距裁剪",
          blocks: [
            {
              type: "paragraph",
              text: "输入从各边裁剪的百分比。扫描文档建议从 5–10% 开始。",
            },
          ],
        },
      ]
    ),
    watermarkPdf: tool(
      "PDF 水印",
      "为 PDF 每一页添加文字或图片水印。",
      "添加水印",
      "下载带水印的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线 PDF 水印",
      "免费在线为 PDF 添加文字水印。",
      "pdf 水印",
      [
        {
          heading: "文字水印",
          blocks: [
            {
              type: "paragraph",
              text: "输入要斜向显示在每页上的文字。",
            },
          ],
        },
      ]
    ),
    pdfToJpg: tool(
      "PDF 转 JPG",
      "将 PDF 转为 JPG — 10 页及以下导出高清图片，超过 10 页自动打包 ZIP。",
      "转换为 JPG",
      "打包 ZIP 下载",
      pdfUpload,
      pdfSubhint,
      "免费 PDF 转 JPG",
      "免费在线将 PDF 转为 JPG。短文档导出高清图片，长文档自动 ZIP 下载。",
      "pdf 转 jpg",
      [
        {
          heading: "智能导出模式",
          blocks: [
            {
              type: "paragraph",
              text: "10 页及以下自动以高分辨率逐页导出 JPG；超过 10 页则整合为 ZIP 压缩包下载。",
            },
          ],
        },
      ]
    ),
    jpgToPdf: tool(
      "JPG 转 PDF",
      "将 JPG、PNG 或 WebP 图片合并为单个 PDF 文档。",
      "创建 PDF",
      "下载 PDF",
      imageUpload,
      imageSub,
      "免费 JPG 转 PDF",
      "免费在线将 JPG 和 PNG 图片转为 PDF。",
      "jpg 转 pdf, 图片转 pdf",
      [
        {
          heading: "多张图片",
          blocks: [
            {
              type: "paragraph",
              text: "选择一张或多张图片。按上传顺序合并为一个 PDF。",
            },
          ],
        },
      ]
    ),
    signPdf: tool(
      "签署 PDF",
      "在每页底部添加文字签名。",
      "签署 PDF",
      "下载已签署的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线签署 PDF",
      "免费在线为 PDF 添加文字签名。",
      "签署 pdf, pdf 签名",
      [
        {
          heading: "文字签名",
          blocks: [
            {
              type: "paragraph",
              text: "输入您的姓名或签名文字。显示在每页右下角。",
            },
          ],
        },
      ]
    ),
    unlockPdf: tool(
      "解锁 PDF",
      "移除您有权打开的 PDF 的密码保护。",
      "解锁 PDF",
      "下载解锁后的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线解锁 PDF",
      "免费在线移除 PDF 密码保护。",
      "解锁 pdf, 移除 pdf 密码",
      [
        {
          heading: "需要密码",
          blocks: [
            {
              type: "paragraph",
              text: "输入当前密码以解密并下载未加密的副本。",
            },
          ],
        },
      ]
    ),
    protectPdf: tool(
      "保护 PDF",
      "为 PDF 文档添加密码加密。",
      "保护 PDF",
      "下载受保护的 PDF",
      pdfUpload,
      pdfSubhint,
      "免费在线保护 PDF",
      "免费在线为 PDF 添加密码保护。",
      "保护 pdf, 加密 pdf",
      [
        {
          heading: "设置强密码",
          blocks: [
            {
              type: "paragraph",
              text: "选择您能记住的密码。以后打开文件时需要此密码。",
            },
          ],
        },
      ]
    ),
    redactImagePdf: tool(
      "图片与 PDF 脱敏",
      "在浏览器中模糊、马赛克或纯色遮盖图片与 PDF 中的敏感区域，数据不离开本机。",
      "下载脱敏文件",
      "下载脱敏文件",
      redactUpload,
      redactSubhint,
      "免费在线图片与 PDF 脱敏 | 模糊与马赛克",
      "在浏览器本地对图片和 PDF 敏感内容进行脱敏处理。",
      "pdf 脱敏, 图片脱敏, 模糊 pdf, 马赛克",
      [
        {
          heading: "本地脱敏",
          blocks: [
            {
              type: "paragraph",
              text: "在预览上拖选矩形即可应用效果。导出前可对每一页单独撤销。",
            },
          ],
        },
      ]
    ),
  },
    seoRichZh,
    { locale: "zh" }
  ),
  ofd: ofdZh,
};
