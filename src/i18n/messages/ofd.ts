import type { Messages } from "@/i18n/types";

export const ofdEn: Messages["ofd"] = {
  hub: {
    title: "OFD Toolbox",
    description:
      "Ten browser-based OFD utilities — convert, merge, compress, read, and export without uploading files to a server.",
    ariaLabel: "OFD toolbox tools",
    localBadge: "100% local processing",
  },
  tools: {
    ofdToPdf: { title: "OFD to PDF", desc: "Convert OFD documents to PDF" },
    ofdMerge: { title: "Merge OFD", desc: "Combine multiple OFD files into one" },
    ofdToImage: { title: "OFD to Image", desc: "Export OFD pages as PNG or JPG" },
    ofdToSvg: { title: "OFD to SVG", desc: "Vector export for each OFD page" },
    ofdToWeb: { title: "OFD to Web", desc: "Generate a standalone HTML preview" },
    ofdToText: { title: "OFD to Text", desc: "Extract plain text from OFD" },
    ofdCompress: { title: "Compress OFD", desc: "Reduce OFD package size locally" },
    ofdToWord: { title: "OFD to Word", desc: "Export extracted text to DOCX" },
    ofdReader: { title: "OFD Reader", desc: "Preview OFD pages in the browser" },
    ofdToLongImage: {
      title: "OFD to Long Image",
      desc: "Stitch all pages into one vertical image",
    },
  },
};

export const ofdZh: Messages["ofd"] = {
  hub: {
    title: "OFD 工具箱",
    description:
      "10 款纯浏览器 OFD 工具 — 转换、合并、压缩、阅读与导出，文件不上传服务器。",
    ariaLabel: "OFD 工具箱导航",
    localBadge: "100% 本地处理",
  },
  tools: {
    ofdToPdf: { title: "OFD 转 PDF", desc: "将 OFD 文档转换为 PDF" },
    ofdMerge: { title: "OFD 合并", desc: "将多个 OFD 文件合并为一个" },
    ofdToImage: { title: "OFD 转图片", desc: "导出 OFD 页面为 PNG 或 JPG" },
    ofdToSvg: { title: "OFD 转 SVG", desc: "按页导出矢量 SVG" },
    ofdToWeb: { title: "OFD 转网页", desc: "生成可独立打开的 HTML 预览" },
    ofdToText: { title: "OFD 转文本", desc: "从 OFD 中提取纯文本" },
    ofdCompress: { title: "OFD 压缩", desc: "在本地减小 OFD 包体积" },
    ofdToWord: { title: "OFD 转 Word", desc: "将提取文本导出为 DOCX" },
    ofdReader: { title: "OFD 阅读器", desc: "在浏览器中预览 OFD 页面" },
    ofdToLongImage: { title: "OFD 转长图", desc: "将所有页面拼接为一张长图" },
  },
};
