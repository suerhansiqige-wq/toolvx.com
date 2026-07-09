import type { Messages } from "@/i18n/types";
import { blogEn } from "./blog";
import { ofdEn } from "./ofd";
import { attachSeoRich } from "@/i18n/seo-rich/attach";
import {
  buildOfdSeoRichFromData,
  ofdSeoHeadingsEn,
} from "@/i18n/seo-rich/ofd-attach";

const pdfUpload = "Click to upload or drag & drop a PDF file here";
const pdfSubhint = "Supports single PDF files";
const pdfMulti = "Click to upload or drag & drop PDF files here";
const pdfMultiSub = "Select multiple PDF files to merge";
const pdfMultiCompressSub =
  "Select one or more PDF files — compress individually or merge first";
const imageUpload = "Click to upload or drag & drop image files here";
const imageSub = "Supports JPG, PNG, and WebP images";
const redactUpload = "Drop an image or PDF here, or click to browse";
const redactSubhint = "Supports JPG, PNG, GIF, WebP, and multi-page PDF";

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
    processing: "Processing…",
    success: "Done! Your file is ready.",
    error: "Could not process this file. Please try another file.",
    seoTitle,
    seoDescription,
    seoKeywords,
    seoSections,
  };
}

export const en: Messages = {
  site: {
    nav: {
      home: "Home",
      posts: "Posts",
      tags: "Tags",
      about: "About",
      archives: "Archives",
      search: "Search",
      tools: "PDF Tools",
      redact: "Redact",
      ofdTools: "OFD Tools",
    },
    footer: {
      copyright: "Copyright",
      allRightsReserved: "All rights reserved.",
    },
    a11y: {
      skipToContent: "Skip to content",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      toggleTheme: "Toggle theme",
      loading: "Loading…",
    },
    sidebar: {
      allTools: "All Tools",
      ariaLabel: "PDF tools navigation",
      sections: {
        compressConvert: "COMPRESS & CONVERT",
        organize: "ORGANIZE",
        security: "SECURITY",
      },
    },
  },
  blog: blogEn,
  menu: {
    pdfTools: "PDF Tools",
    columns: {
      compressConvert: "COMPRESS & CONVERT",
      organize: "ORGANIZE",
      viewEdit: "VIEW & EDIT",
      convertFromPdf: "CONVERT FROM PDF",
      convertToPdf: "CONVERT TO PDF",
      securitySign: "SECURITY & SIGN",
    },
    tools: {
      compressPdf: "Compress PDF",
      mergePdf: "Merge PDF",
      splitPdf: "Split PDF",
      rotatePdf: "Rotate PDF",
      deletePdfPages: "Delete PDF Pages",
      editPdf: "Edit PDF",
      pdfReader: "PDF Reader",
      numberPages: "Number Pages",
      cropPdf: "Crop PDF",
      watermarkPdf: "Watermark PDF",
      pdfToJpg: "PDF to JPG",
      jpgToPdf: "JPG to PDF",
      signPdf: "Sign PDF",
      unlockPdf: "Unlock PDF",
      protectPdf: "Protect PDF",
      redactImagePdf: "Redact Image & PDF",
    },
  },
  common: {
    download: "Download",
    processing: "Processing…",
    success: "Done! Your file is ready.",
    error: "Something went wrong.",
    selectFile: "Please select a file first.",
    password: "Password",
    confirmPassword: "Confirm password",
    pageNumbers: "Pages to delete (e.g. 1,3,5-7)",
    watermarkText: "Watermark text",
    signatureText: "Signature text",
    rotation: "Rotation angle",
    splitAtPage: "Split after page number",
    splitPages: "Pages to extract",
    splitPagesExample: "1, 2, 3",
    pageNumberStartAt: "Start numbering on page",
    pageNumberStartFrom: "First page number",
    watermarkMode: "Watermark type",
    watermarkTypeText: "Text watermark",
    watermarkTypeImage: "Image watermark",
    watermarkImage: "Watermark image",
    cropMargin: "Crop margin (%)",
    metadataTitle: "Document title",
    metadataAuthor: "Author",
    metadataSubject: "Subject",
    compressionLegend: "Compression level",
    compressionBalanced: "Balanced",
    compressionStrong: "Strong",
    compressionMaximum: "Maximum",
    compressionBalancedHint: "HD output",
    compressionStrongHint: "Under 2 MB",
    compressionMaximumHint: "Under 1 MB",
    compressEach: "Compress separately",
    compressMerge: "Merge & compress",
    watermarkDefault: "CONFIDENTIAL",
    signatureDefault: "Signed",
    prevPage: "Previous",
    nextPage: "Next",
    pageOf: "Page {current} of {total}",
    hubIntro: "Pick a converter below — every tool runs locally in your browser.",
    clickToReplace: "Click to replace file",
    clickToReplaceMultiple: "Click to change files",
    splitMode: "Split mode",
    splitEveryPage: "Every page (ZIP)",
    splitAtPageOption: "At page number",
    pageNumbersExample: "1,3,5-7",
    signaturePlaceholder: "Your name",
    compressStats: "{orig} → {out} ({pct}% smaller)",
    needTwoFiles: "Need 2+ files",
    passwordMismatch: "Password mismatch",
    seoHowToHeading: "How to use this tool",
    seoFaqHeading: "Frequently asked questions",
  },
  tools: attachSeoRich({
    compressPdf: tool(
      "Compress PDF",
      "Reduce PDF file size in seconds — upload one or many PDFs, then compress with default settings or a custom size limit.",
      "Default compress",
      "Download Compressed PDF",
      pdfMulti,
      pdfMultiCompressSub,
      "Compress PDF Online Free | Reduce PDF File Size",
      "Compress PDF files online for free. Shrink large PDFs for email and web sharing in seconds.",
      "compress pdf, pdf compressor, reduce pdf size, shrink pdf",
      [
        {
          heading: "Why compress PDF files?",
          blocks: [
            {
              type: "paragraph",
              text: "Large PDFs slow down email delivery and hurt page load times. Compressing reduces file size while keeping documents readable.",
            },
          ],
        },
        {
          heading: "How to compress a PDF",
          blocks: [
            {
              type: "list",
              ordered: true,
              items: [
                "Upload one or more PDF files.",
                "Use Default compress (output never larger than the original), or enter a max size in MB and click Compress to limit.",
                "Compress a single file, each file separately (ZIP), or merge then compress.",
              ],
            },
          ],
        },
      ]
    ),
    mergePdf: tool(
      "Merge PDF",
      "Combine multiple PDF files into one document in the order you choose.",
      "Merge PDFs",
      "Download Merged PDF",
      pdfMulti,
      pdfMultiSub,
      "Merge PDF Online Free | Combine PDF Files",
      "Merge multiple PDF files into one document online for free. Fast, simple, and secure.",
      "merge pdf, combine pdf, join pdf files",
      [
        {
          heading: "How to merge PDFs",
          blocks: [
            {
              type: "list",
              ordered: true,
              items: [
                "Upload two or more PDF files.",
                "Click Merge PDFs.",
                "Download the combined document.",
              ],
            },
          ],
        },
      ]
    ),
    splitPdf: tool(
      "Split PDF",
      "Split a PDF into separate files — one per page or at a specific page.",
      "Split PDF",
      "Download Split Files",
      pdfUpload,
      pdfSubhint,
      "Split PDF Online Free | Separate PDF Pages",
      "Split PDF files into individual pages or ranges. Free online PDF splitter.",
      "split pdf, separate pdf pages, extract pdf pages",
      [
        {
          heading: "Split options",
          blocks: [
            {
              type: "paragraph",
              text: "Split every page into its own PDF (downloaded as a ZIP), or split at a specific page number into two files.",
            },
          ],
        },
      ]
    ),
    rotatePdf: tool(
      "Rotate PDF",
      "Rotate all pages in your PDF by 90°, 180°, or 270°.",
      "Rotate PDF",
      "Download Rotated PDF",
      pdfUpload,
      pdfSubhint,
      "Rotate PDF Online Free | Turn PDF Pages",
      "Rotate PDF pages online for free. Fix sideways scans in seconds.",
      "rotate pdf, turn pdf pages, fix pdf orientation",
      [
        {
          heading: "How to rotate a PDF",
          blocks: [
            {
              type: "list",
              ordered: true,
              items: [
                "Upload your PDF.",
                "Select a rotation angle.",
                "Download the rotated file.",
              ],
            },
          ],
        },
      ]
    ),
    deletePdfPages: tool(
      "Delete PDF Pages",
      "Remove unwanted pages from your PDF document.",
      "Delete Pages",
      "Download Updated PDF",
      pdfUpload,
      pdfSubhint,
      "Delete PDF Pages Online Free",
      "Remove pages from a PDF online for free. Enter page numbers or ranges to delete.",
      "delete pdf pages, remove pdf pages",
      [
        {
          heading: "Page number format",
          blocks: [
            {
              type: "paragraph",
              text: "Enter page numbers separated by commas, or ranges like 5-8. Example: 1,3,5-7",
            },
          ],
        },
      ]
    ),
    editPdf: tool(
      "Edit PDF",
      "Update PDF document properties such as title, author, and subject.",
      "Save Metadata",
      "Download Updated PDF",
      pdfUpload,
      pdfSubhint,
      "Edit PDF Metadata Online Free",
      "Edit PDF title, author, and subject metadata online for free.",
      "edit pdf metadata, pdf properties",
      [
        {
          heading: "What you can edit",
          blocks: [
            {
              type: "paragraph",
              text: "This tool updates document metadata (title, author, subject). For visual editing, use a desktop PDF editor.",
            },
          ],
        },
      ]
    ),
    pdfReader: tool(
      "PDF Reader",
      "View PDF files directly in your browser — no download required.",
      "Open PDF",
      "Download PDF",
      pdfUpload,
      pdfSubhint,
      "PDF Reader Online Free | View PDF in Browser",
      "Read and preview PDF files online for free. Navigate pages instantly in your browser.",
      "pdf reader, view pdf online, pdf viewer",
      [
        {
          heading: "Private PDF viewing",
          blocks: [
            {
              type: "paragraph",
              text: "Your file stays on your device. Use the page controls to browse your document.",
            },
          ],
        },
      ]
    ),
    numberPages: tool(
      "Number Pages",
      "Add page numbers to every page of your PDF.",
      "Add Page Numbers",
      "Download Numbered PDF",
      pdfUpload,
      pdfSubhint,
      "Number PDF Pages Online Free",
      "Add page numbers to PDF documents online for free.",
      "number pdf pages, add page numbers",
      [
        {
          heading: "Automatic numbering",
          blocks: [
            {
              type: "paragraph",
              text: "Choose which PDF page to start on and the first number shown. Preview all pages in a horizontal row after upload.",
            },
          ],
        },
      ]
    ),
    cropPdf: tool(
      "Crop PDF",
      "Trim margins from every page of your PDF.",
      "Crop PDF",
      "Download Cropped PDF",
      pdfUpload,
      pdfSubhint,
      "Crop PDF Online Free | Trim PDF Margins",
      "Crop PDF margins online for free. Remove white borders from scanned documents.",
      "crop pdf, trim pdf margins",
      [
        {
          heading: "Margin crop",
          blocks: [
            {
              type: "paragraph",
              text: "Enter a percentage to trim from each edge. Start with 5–10% for scanned documents.",
            },
          ],
        },
      ]
    ),
    watermarkPdf: tool(
      "Watermark PDF",
      "Add a text or image watermark to every page of your PDF.",
      "Add Watermark",
      "Download Watermarked PDF",
      pdfUpload,
      pdfSubhint,
      "Watermark PDF Online Free",
      "Add text watermarks to PDF files online for free.",
      "watermark pdf, add watermark to pdf",
      [
        {
          heading: "Text watermark",
          blocks: [
            {
              type: "paragraph",
              text: "Enter the text to display diagonally across each page.",
            },
          ],
        },
      ]
    ),
    pdfToJpg: tool(
      "PDF to JPG",
      "Convert PDF pages to JPG — 10 pages or fewer export as HD images; longer PDFs download as ZIP.",
      "Convert to JPG",
      "Download ZIP",
      pdfUpload,
      pdfSubhint,
      "PDF to JPG Online Free | Convert PDF to Images",
      "Convert PDF to JPG images online for free. Short PDFs export as HD images; longer files download as ZIP.",
      "pdf to jpg, pdf to image",
      [
        {
          heading: "High-quality export",
          blocks: [
            {
              type: "paragraph",
              text: "Up to 10 pages are exported as high-resolution JPG files (one per page). PDFs with more than 10 pages are packaged into a ZIP archive.",
            },
          ],
        },
      ]
    ),
    jpgToPdf: tool(
      "JPG to PDF",
      "Combine JPG, PNG, or WebP images into a single PDF document.",
      "Create PDF",
      "Download PDF",
      imageUpload,
      imageSub,
      "JPG to PDF Online Free | Images to PDF",
      "Convert JPG and PNG images to PDF online for free.",
      "jpg to pdf, image to pdf, png to pdf",
      [
        {
          heading: "Multiple images",
          blocks: [
            {
              type: "paragraph",
              text: "Select one or more images. They are combined in upload order into one PDF.",
            },
          ],
        },
      ]
    ),
    signPdf: tool(
      "Sign PDF",
      "Add a text signature to the bottom of every page.",
      "Sign PDF",
      "Download Signed PDF",
      pdfUpload,
      pdfSubhint,
      "Sign PDF Online Free | Add Signature",
      "Add a text signature to PDF documents online for free.",
      "sign pdf, pdf signature",
      [
        {
          heading: "Text signature",
          blocks: [
            {
              type: "paragraph",
              text: "Enter your name or signature text. It appears at the bottom-right of each page.",
            },
          ],
        },
      ]
    ),
    unlockPdf: tool(
      "Unlock PDF",
      "Remove password protection from a PDF you are allowed to open.",
      "Unlock PDF",
      "Download Unlocked PDF",
      pdfUpload,
      pdfSubhint,
      "Unlock PDF Online Free | Remove PDF Password",
      "Remove password protection from PDF files online.",
      "unlock pdf, remove pdf password",
      [
        {
          heading: "Password required",
          blocks: [
            {
              type: "paragraph",
              text: "Enter the current password to decrypt and download an unlocked copy.",
            },
          ],
        },
      ]
    ),
    protectPdf: tool(
      "Protect PDF",
      "Add password encryption to your PDF document.",
      "Protect PDF",
      "Download Protected PDF",
      pdfUpload,
      pdfSubhint,
      "Protect PDF Online Free | Password Protect PDF",
      "Password-protect PDF files online for free.",
      "protect pdf, encrypt pdf, password pdf",
      [
        {
          heading: "Set a strong password",
          blocks: [
            {
              type: "paragraph",
              text: "Choose a password you will remember. You will need it to open the file later.",
            },
          ],
        },
      ]
    ),
    redactImagePdf: tool(
      "Redact Image & PDF",
      "Blur, pixelate, or blackout sensitive areas on images and PDFs — 100% in your browser.",
      "Download Redacted File",
      "Download Redacted File",
      redactUpload,
      redactSubhint,
      "Redact Image & PDF Online Free | Blur & Mosaic",
      "Redact sensitive content on images and PDFs locally in your browser.",
      "redact pdf, redact image, blur pdf, pixelate image",
      [
        {
          heading: "Local redaction",
          blocks: [
            {
              type: "paragraph",
              text: "Draw a rectangle on the preview to apply your chosen effect. Use undo per page before exporting.",
            },
          ],
        },
      ]
    ),
  }, undefined, { locale: "en" }),
  ofd: {
    ...ofdEn,
    seoHeadings: ofdSeoHeadingsEn,
    seoRich: buildOfdSeoRichFromData("en"),
  },
};
