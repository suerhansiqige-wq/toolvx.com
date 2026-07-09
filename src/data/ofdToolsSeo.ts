import type { FAQItem } from "@/data/toolsSeo";

export type OfdToolSEO = {
  id: string;
  /** `<title>` — 50–60 chars, intent-focused. */
  title: string;
  /** Meta description — ≤160 chars, keywords + local processing. */
  description: string;
  keywords: string[];
  h1: string;
  /** H2: What is this tool? */
  whatIs: string;
  /** Use-case bullets under "What is". */
  scenarios: string[];
  steps: string[];
  /** H2: Why choose us (EEAT / privacy). */
  whyChoose: string;
  whyChoosePoints: string[];
  faqs: FAQItem[];
};

const privacyNote =
  "All OFD parsing runs locally in your browser — invoices, contracts, and government documents never leave your device.";

function seo(
  partial: Omit<OfdToolSEO, "whyChoose"> & { whyChoose?: string }
): OfdToolSEO {
  return {
    whyChoose: partial.whyChoose ?? privacyNote,
    ...partial,
  };
}

export const ofdToolsSeoData: Record<string, OfdToolSEO> = {
  "ofd-to-pdf": seo({
    id: "ofd-to-pdf",
    title: "Free Online OFD to PDF Converter — Fast & Secure | ToolVX",
    description:
      "Convert OFD to PDF online for free. Batch-ready, high-fidelity export. 100% browser-based — your files are never uploaded to any server.",
    keywords: [
      "ofd to pdf",
      "convert ofd to pdf",
      "ofd pdf converter online",
      "free ofd to pdf",
      "ofd 转 pdf",
    ],
    h1: "Free Online OFD to PDF Converter",
    whatIs:
      "An OFD to PDF converter transforms Open Fixed-layout Document (OFD) files — widely used for Chinese e-invoices, tax receipts, and official PDF alternatives — into standard PDF files you can open in Adobe Reader, print, email, or archive.",
    scenarios: [
      "Electronic VAT invoices (电子发票) and fiscal receipts",
      "Government and enterprise documents distributed as OFD",
      "Archiving OFD files in a universal PDF format",
      "Sharing with colleagues who only have PDF software",
    ],
    steps: [
      "Open this page and click the upload area (or drag and drop your .ofd file).",
      "Wait for the status message confirming the file is ready.",
      "Click Convert to render pages locally and build a PDF.",
      "Download the PDF instantly — no account, no cloud upload.",
    ],
    whyChoosePoints: [
      "Zero server upload — sensitive invoice data stays on your computer",
      "Works with common OFD 1.x packages including e-invoice layouts",
      "No installation — runs in Chrome, Edge, Firefox, and Safari",
      "Free with no watermark on exported PDFs",
    ],
    faqs: [
      {
        question: "Is it safe to convert confidential OFD invoices here?",
        answer:
          "Yes. Conversion is performed entirely inside your browser using client-side JavaScript. Files are not transmitted to our servers or stored in the cloud.",
      },
      {
        question: "Do I need to install OFD reader software?",
        answer:
          "No. Upload the .ofd file in this page and download a PDF. No plugins or desktop OFD viewers are required.",
      },
      {
        question: "Will the PDF look the same as the original OFD?",
        answer:
          "We rasterize each page at high resolution to preserve layout, stamps, and images. Complex fonts may differ slightly if they are not embedded in the OFD package.",
      },
      {
        question: "Can I convert multiple OFD files at once?",
        answer:
          "Upload one file per conversion session on this page. To combine several OFDs first, use our OFD Merge tool, then convert the merged file to PDF.",
      },
    ],
  }),

  "ofd-merge": seo({
    id: "ofd-merge",
    title: "Merge OFD Files Online Free — Combine Documents in Browser",
    description:
      "Merge multiple OFD files into one package locally. No upload to server. Ideal for batch invoices and multi-part government forms.",
    keywords: ["merge ofd", "combine ofd files", "ofd merge online", "ofd 合并"],
    h1: "Merge OFD Files Online",
    whatIs:
      "An OFD merge tool joins several Open Fixed-layout Document packages into a single .ofd file with multiple document bodies — useful when you receive invoices or forms as separate downloads.",
    scenarios: [
      "Combining monthly e-invoices into one archive",
      "Merging contract attachments distributed as separate OFDs",
      "Packaging multi-part government submissions",
    ],
    steps: [
      "Select at least two .ofd files (Ctrl/Shift + click in the file dialog).",
      "Wait for merge processing to finish — a download link appears automatically.",
      "Click Merge again if you need to re-download the combined file.",
      "Open the merged OFD in any compatible reader or convert it to PDF.",
    ],
    whyChoosePoints: [
      "Merging happens locally — no document content is sent over the network",
      "Preserves each source document as a separate Doc body in the OFD package",
      "Free and unlimited for personal and business use",
    ],
    faqs: [
      {
        question: "How many OFD files can I merge?",
        answer:
          "You can merge two or more files in one session. Select all files at once when uploading for best results.",
      },
      {
        question: "Will digital signatures remain valid after merging?",
        answer:
          "Signatures from source files are copied structurally, but validity depends on your viewer and original signing policy. For legal submissions, verify with your compliance team.",
      },
      {
        question: "Why did merge fail for my files?",
        answer:
          "Ensure each file is a valid .ofd zip package. Some proprietary exports use non-standard folder names — try re-exporting from the original application.",
      },
      {
        question: "Are my files uploaded to a server?",
        answer: "No. Merging uses in-browser zip manipulation only.",
      },
    ],
  }),

  "ofd-to-image": seo({
    id: "ofd-to-image",
    title: "OFD to Image Converter — Export PNG Pages Online Free",
    description:
      "Export every OFD page as PNG images in a ZIP file. 100% client-side processing — private and secure for invoices and certificates.",
    keywords: ["ofd to png", "ofd to image", "ofd 转图片", "export ofd pages"],
    h1: "OFD to Image (PNG) Converter",
    whatIs:
      "This tool exports each page of an OFD document as a high-quality PNG image, delivered in a ZIP archive — handy for slides, thumbnails, WeChat sharing, or inserting into other apps.",
    scenarios: [
      "Sharing invoice screenshots without sending the full OFD",
      "Creating image previews for document management systems",
      "Extracting certificate or form pages as pictures",
    ],
    steps: [
      "Upload your .ofd file via click or drag-and-drop.",
      "Click Convert to render and export all pages as PNG.",
      "Download the ZIP containing page-1.png, page-2.png, and so on.",
    ],
    whyChoosePoints: [
      "Full-page rasterization keeps stamps, photos, and borders intact",
      "No cloud upload — ideal for personal ID and invoice data",
      "PNG output supports transparency where the renderer provides it",
    ],
    faqs: [
      {
        question: "What image format is used?",
        answer: "Pages are exported as lossless PNG files inside a ZIP archive.",
      },
      {
        question: "Why is text missing in my exported image?",
        answer:
          "Some OFDs rely on embedded fonts. If text is missing, open the original in a desktop OFD reader or ensure fonts are embedded in the source file.",
      },
      {
        question: "Is there a page limit?",
        answer:
          "Processing runs on your device; very large documents may take longer depending on CPU and memory.",
      },
      {
        question: "Can I get JPG instead of PNG?",
        answer: "This tool exports PNG for maximum quality. Use OFD to PDF and then PDF to JPG if you need JPEG.",
      },
    ],
  }),

  "ofd-to-long-image": seo({
    id: "ofd-to-long-image",
    title: "OFD to Long Image — Stitch Pages into One PNG Online",
    description:
      "Combine all OFD pages into a single vertical long image. Free, browser-based, and private — no server upload.",
    keywords: ["ofd long image", "ofd to long screenshot", "ofd 长图", "stitch ofd pages"],
    h1: "OFD to Long Image Converter",
    whatIs:
      "OFD to long image stitches every page of your document into one continuous vertical PNG — popular for mobile viewing, social sharing, and quick scrolling previews.",
    scenarios: [
      "Sharing a full certificate or invoice as one phone-friendly image",
      "Creating scrollable previews for chat apps",
      "Archiving multi-page OFD as a single snapshot",
    ],
    steps: [
      "Upload the .ofd file you want to stitch.",
      "Click Convert to render pages and combine them vertically.",
      "Download the single long PNG file.",
    ],
    whyChoosePoints: [
      "Automatic vertical stitching with consistent width",
      "Processed locally — no third-party image servers",
      "Free one-click download",
    ],
    faqs: [
      {
        question: "How are pages arranged?",
        answer:
          "Pages are stacked top to bottom in document order with a small gap between them, centered on the widest page width.",
      },
      {
        question: "What is the output resolution?",
        answer:
          "Resolution follows the OFD render width (optimized for screen and print readability).",
      },
      {
        question: "Can I edit the long image afterward?",
        answer: "Yes. The output is a standard PNG you can crop or annotate in any image editor.",
      },
      {
        question: "Is my document uploaded?",
        answer: "No. Rendering and stitching run entirely in your browser.",
      },
    ],
  }),

  "ofd-to-svg": seo({
    id: "ofd-to-svg",
    title: "OFD to SVG Export — Vector Pages Online Free",
    description:
      "Export OFD pages as SVG vector files in a ZIP. Browser-local processing protects invoices and official documents.",
    keywords: ["ofd to svg", "ofd vector export", "ofd 转 svg"],
    h1: "OFD to SVG Converter",
    whatIs:
      "This tool extracts vector SVG representations of OFD pages where available — useful for design workflows, further editing in Illustrator/Inkscape, or web embedding.",
    scenarios: [
      "Design teams needing scalable graphics from OFD",
      "Web developers embedding document graphics",
      "Technical archiving of vector content",
    ],
    steps: [
      "Upload your .ofd document.",
      "Click Convert to extract SVG per page.",
      "Download the ZIP of SVG files.",
    ],
    whyChoosePoints: [
      "Vector output scales without blur for diagrams and line art",
      "Local export keeps confidential vector data private",
      "No desktop OFD software required",
    ],
    faqs: [
      {
        question: "Does every OFD export clean SVG?",
        answer:
          "SVG is exported when the renderer produces SVG elements. Scan-heavy or photo-heavy pages may have limited vector content.",
      },
      {
        question: "Can I edit text in the SVG?",
        answer: "Editable text depends on how the OFD encodes text objects in the source file.",
      },
      {
        question: "Is conversion secure?",
        answer: "Yes — files never leave your browser.",
      },
      {
        question: "What is inside the ZIP?",
        answer: "One .svg file per page, named sequentially.",
      },
    ],
  }),

  "ofd-to-web": seo({
    id: "ofd-to-web",
    title: "OFD to HTML Web Page — Standalone Preview Export",
    description:
      "Generate a standalone HTML file from OFD for offline viewing. 100% local conversion — no upload, no login.",
    keywords: ["ofd to html", "ofd web export", "ofd 转网页"],
    h1: "OFD to Web (HTML) Exporter",
    whatIs:
      "OFD to web creates a self-contained HTML file with embedded page images — open it in any browser without an OFD reader installed.",
    scenarios: [
      "Offline document distribution to non-technical users",
      "Quick internal previews on intranet static hosting",
      "Email-friendly attachments when OFD is not supported",
    ],
    steps: [
      "Upload the .ofd file.",
      "Click Convert to build the HTML snapshot.",
      "Download the .html file and open it locally in your browser.",
    ],
    whyChoosePoints: [
      "Single HTML file easy to share on USB or email",
      "No server-side rendering of your document content",
      "Works offline after download",
    ],
    faqs: [
      {
        question: "Does the HTML need internet?",
        answer: "No. Page images are embedded; the file works fully offline.",
      },
      {
        question: "Can I host the HTML on my website?",
        answer: "Yes. Upload the exported HTML to any static host.",
      },
      {
        question: "Is content indexed by search engines?",
        answer: "Only if you publish the HTML publicly — we do not host your files.",
      },
      {
        question: "Are animations or forms preserved?",
        answer: "Export is a visual snapshot; interactive OFD features may not transfer.",
      },
    ],
  }),

  "ofd-to-text": seo({
    id: "ofd-to-text",
    title: "OFD to Text — Extract Plain Text Online Free",
    description:
      "Extract readable text from OFD files locally. Searchable output for invoices and contracts — nothing uploaded to servers.",
    keywords: ["ofd to text", "extract text from ofd", "ofd 转文本"],
    h1: "OFD to Text Extractor",
    whatIs:
      "OFD to text pulls textual content from OFD XML structures (TextCode objects) into a plain .txt file — helpful for search, quoting, or feeding into other systems.",
    scenarios: [
      "Copying invoice numbers and amounts into spreadsheets",
      "Indexing document content for internal search",
      "Quickly quoting contract clauses",
    ],
    steps: [
      "Upload your .ofd file.",
      "Text is extracted automatically on upload.",
      "Click Extract text to download the .txt file.",
    ],
    whyChoosePoints: [
      "Fast XML-based extraction without cloud OCR",
      "Private — fiscal data stays on-device",
      "Useful supplement when visual conversion fails",
    ],
    faqs: [
      {
        question: "Will layout be preserved?",
        answer: "No. Output is plain text without formatting or positioning.",
      },
      {
        question: "Why is some text missing?",
        answer:
          "Text drawn purely as images or using unsupported encodings may not appear. Try OFD to PDF for visual copies.",
      },
      {
        question: "Does it work on scanned OFDs?",
        answer: "Scanned image-only OFDs contain no extractable text — OCR is not included.",
      },
      {
        question: "Is extraction secure?",
        answer: "Yes. Parsing runs locally in your browser.",
      },
    ],
  }),

  "ofd-compress": seo({
    id: "ofd-compress",
    title: "Compress OFD Online — Reduce File Size in Browser",
    description:
      "Shrink OFD package size with DEFLATE compression locally. Free tool — your documents are never uploaded.",
    keywords: ["compress ofd", "reduce ofd size", "ofd 压缩"],
    h1: "OFD Compressor",
    whatIs:
      "OFD compress re-packages your .ofd zip archive with maximum DEFLATE compression to reduce file size for email attachments and storage — without altering document semantics.",
    scenarios: [
      "Emailing large e-invoice OFD attachments",
      "Saving disk space in document archives",
      "Optimizing OFD before merge or conversion",
    ],
    steps: [
      "Upload the .ofd file to compress.",
      "Compression runs immediately — download link appears when done.",
      "Compare file size with the original and save the smaller copy.",
    ],
    whyChoosePoints: [
      "Local re-packaging — no upload of invoice content",
      "Lossless at the document structure level",
      "One-click download",
    ],
    faqs: [
      {
        question: "How much smaller will the file get?",
        answer:
          "Savings depend on how well the original was compressed. Already-optimized OFDs may see modest gains.",
      },
      {
        question: "Is the document still valid?",
        answer: "Yes. Internal XML and resources are preserved; only zip compression changes.",
      },
      {
        question: "Do signatures break?",
        answer: "Structural signatures are kept, but verify in your target OFD viewer if compliance matters.",
      },
      {
        question: "Is it safe for sensitive data?",
        answer: "Compression runs entirely in your browser.",
      },
    ],
  }),

  "ofd-reader": seo({
    id: "ofd-reader",
    title: "OFD Reader Online — Export OFD to PDF in Browser",
    description:
      "Open and export OFD documents locally. Convert to PDF without uploading invoices or official files to any server.",
    keywords: ["ofd reader online", "open ofd browser", "ofd 阅读器"],
    h1: "Online OFD Reader",
    whatIs:
      "This browser-based OFD reader lets you load Open Fixed-layout Document files and export them as PDF for viewing in standard readers — without installing Chinese OFD client software.",
    scenarios: [
      "Opening e-invoices received as .ofd on any operating system",
      "Quick PDF export for printing or annotation",
      "Validating document content before forwarding",
    ],
    steps: [
      "Upload the .ofd file you need to view.",
      "Click Export PDF to render pages locally.",
      "Download and open the PDF in your preferred viewer.",
    ],
    whyChoosePoints: [
      "No plug-ins or government client installs required",
      "Documents stay on your machine during processing",
      "Free PDF export for universal viewing",
    ],
    faqs: [
      {
        question: "Can I scroll pages in the browser?",
        answer:
          "This tool focuses on secure export. For inline viewing, export to PDF or use OFD to Image/Long Image.",
      },
      {
        question: "Does it support OFD 1.1 invoices?",
        answer: "Common OFD 1.x invoice packages are supported; edge cases may vary by issuer.",
      },
      {
        question: "Are files uploaded?",
        answer: "No. Parsing and rendering are client-side only.",
      },
      {
        question: "Can I print the document?",
        answer: "Export PDF and print from your PDF viewer for best results.",
      },
    ],
  }),
};

export function getOfdToolSeo(slug: string): OfdToolSEO | undefined {
  return ofdToolsSeoData[slug];
}

export function getOfdToolSeoOrThrow(slug: string): OfdToolSEO {
  const seo = getOfdToolSeo(slug);
  if (!seo) throw new Error(`Missing OFD SEO data for slug: ${slug}`);
  return seo;
}
