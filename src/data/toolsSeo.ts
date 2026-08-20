import { redactToolFaqsForSchema, redactToolSeo } from "./redactToolSeo";
import { withFreeOnlineEn } from "@/utils/seo-free-online";

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ToolSEO {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  introduction: string;
  steps: string[];
  faqs: FAQItem[];
  /** Core feature list for WebApplication JSON-LD schema. */
  features: string[];
}

export const toolsSeoData: Record<string, ToolSEO> = {
  "compress-pdf": {
    id: "compress-pdf",
    title: "Compress PDF Online - Reduce PDF File Size for Free",
    description:
      "Free online PDF compressor to reduce file size instantly while maintaining readable quality. Runs in your browser — safe, fast, and no installation required.",
    keywords: [
      "compress pdf",
      "reduce pdf size",
      "shrink pdf online",
      "free pdf compressor",
    ],
    h1: "Free Online PDF Compressor",
    introduction:
      "Optimize and shrink PDF documents without leaving your device. Choose a compression level that fits email attachments, web uploads, or archival storage — all processed locally in your browser.",
    steps: [
      "Click the upload area or drag and drop one or more PDF files.",
      "Select a compression level: Balanced (HD output), Strong (under 2 MB), or Maximum (under 1 MB).",
      "Click Compress PDF — or use separate / merge options when multiple files are uploaded.",
      "Download your smaller PDF instantly. No account or software required.",
    ],
    features: [
      "Multiple compression levels (Balanced, Strong, Maximum)",
      "Batch PDF processing",
      "Local browser-based processing — no server upload",
      "Drag-and-drop file upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "pdf-to-jpg": {
    id: "pdf-to-jpg",
    title: "PDF to JPG Converter - Convert PDF Pages to Images Free",
    description:
      "Convert PDF pages to high-quality JPG images online for free. Short documents export as HD images; longer PDFs download as ZIP. 100% browser-based.",
    keywords: [
      "pdf to jpg",
      "convert pdf to image",
      "pdf to jpeg online",
      "extract images from pdf",
    ],
    h1: "Convert PDF to JPG Images Online",
    introduction:
      "Turn PDF pages into crisp JPG images in seconds. PDFs with 10 pages or fewer export as individual HD files with a preview grid; longer documents are packaged into a convenient ZIP download.",
    steps: [
      "Upload your PDF file using click or drag-and-drop.",
      "Review the page count — the tool automatically picks HD export or ZIP mode.",
      "Click Convert to JPG and wait for local processing to finish.",
      "Download individual JPG files or a single ZIP archive, depending on page count.",
    ],
    features: [
      "High-DPI page rendering",
      "Single-file HD image export",
      "Multi-page ZIP archive download",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "jpg-to-pdf": {
    id: "jpg-to-pdf",
    title: "JPG to PDF Converter - Convert Images to PDF Online Free",
    description:
      "Convert JPG, PNG, and WebP images to a single PDF in seconds. Merge multiple pictures into one document — free, private, and browser-based.",
    keywords: [
      "jpg to pdf",
      "convert image to pdf",
      "pictures to pdf",
      "png to pdf",
    ],
    h1: "Convert Images (JPG/PNG) to PDF Online",
    introduction:
      "Transform photos, scans, and screenshots into a clean, shareable PDF. Upload multiple images and combine them in order — perfect for receipts, portfolios, and scanned paperwork.",
    steps: [
      "Select and upload your images (JPG, PNG, or WebP).",
      "Add more files if needed; they merge in upload order.",
      "Click Create PDF to build your document locally.",
      "Download the generated PDF file to your device.",
    ],
    features: [
      "Support for JPG, PNG, and WebP formats",
      "Merge multiple images into one PDF",
      "Automatic page ordering",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "merge-pdf": {
    id: "merge-pdf",
    title: "Merge PDF Online - Combine Multiple PDF Files for Free",
    description:
      "Combine two or more PDF files into one document online. Reorder files before merging. Free, secure, and processed locally in your browser.",
    keywords: [
      "merge pdf",
      "combine pdf files",
      "pdf joiner online",
      "put pdfs together",
    ],
    h1: "Combine PDF Files Online Instantly",
    introduction:
      "Join separate PDF chapters, invoices, or reports into one organized file. Upload multiple documents, arrange them left to right, and download a single merged PDF.",
    steps: [
      "Upload all PDF files you want to combine.",
      "Drag thumbnails or use the add button to adjust file order.",
      "Click Merge PDF once at least two files are in the queue.",
      "Download your single combined PDF document.",
    ],
    features: [
      "Drag-to-reorder file arrangement",
      "Unlimited file merging",
      "Preserves original formatting and fonts",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "split-pdf": {
    id: "split-pdf",
    title: "Split PDF Online - Extract Pages from PDF Free",
    description:
      "Separate PDF pages or extract specific ranges into new files online. Split every page to ZIP or pick pages like 1,2,3. Free and browser-based.",
    keywords: [
      "split pdf",
      "extract pdf pages",
      "separate pdf files",
      "divide pdf",
    ],
    h1: "Split PDF Pages and Extract Documents",
    introduction:
      "Divide large PDFs into smaller parts or pull out only the pages you need. Preview every page, then export all pages as a ZIP or extract selected page numbers.",
    steps: [
      "Upload your PDF document.",
      "Choose Every page (ZIP) or enter specific pages to extract (e.g. 1, 2, 3).",
      "Click Split PDF to process the file locally.",
      "Download individual PDFs or a ZIP archive of split files.",
    ],
    features: [
      "Extract specific page ranges",
      "Split every page into individual PDFs (ZIP)",
      "Visual page preview before splitting",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "rotate-pdf": {
    id: "rotate-pdf",
    title: "Rotate PDF Online - Flip and Turn PDF Pages Free",
    description:
      "Rotate all pages in a PDF by 90°, 180°, or 270° online for free. Fix scanned orientation permanently — processed locally in your browser.",
    keywords: [
      "rotate pdf",
      "flip pdf pages online",
      "turn pdf upside down",
      "fix pdf orientation",
    ],
    h1: "Rotate and Flip PDF Pages Online",
    introduction:
      "Fix upside-down or sideways scans in one step. Pick a rotation angle and apply it to every page, then download a correctly oriented PDF.",
    steps: [
      "Upload the PDF that needs rotation.",
      "Select 90°, 180°, or 270° from the rotation options.",
      "Click Rotate PDF to apply the change locally.",
      "Download your re-oriented PDF file.",
    ],
    features: [
      "Rotate by 90°, 180°, or 270°",
      "Apply rotation to all pages at once",
      "Fix scanned document orientation",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "delete-pdf-pages": {
    id: "delete-pdf-pages",
    title: "Delete PDF Pages Online - Remove Pages from PDF Free",
    description:
      "Remove unwanted pages from a PDF online. Select pages to delete with ranges like 1,3,5-7 and download a clean file — free and private.",
    keywords: [
      "delete pdf pages",
      "remove page from pdf",
      "discard pdf pages",
      "cut pages from pdf",
    ],
    h1: "Remove Unwanted Pages from PDF",
    introduction:
      "Clean up documents by removing blank pages, duplicates, or sensitive sections before sharing. Preview all pages, specify what to delete, and export a streamlined PDF.",
    steps: [
      "Upload your PDF file.",
      "Browse the page preview row and enter pages to remove (e.g. 1,3,5-7).",
      "Click Delete Pages to rebuild the document without those pages.",
      "Download the updated PDF with only the pages you kept.",
    ],
    features: [
      "Delete pages by number or range (e.g. 1,3,5-7)",
      "Visual page preview before deletion",
      "Reduces file size by removing unwanted content",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "edit-pdf": {
    id: "edit-pdf",
    title: "Edit PDF Metadata Online - Update Title, Author & Subject",
    description:
      "Edit PDF document properties online for free. Change title, author, and subject metadata in your browser — no software install required.",
    keywords: [
      "edit pdf metadata",
      "pdf properties editor",
      "change pdf title",
      "pdf author online",
    ],
    h1: "Edit PDF Document Properties Online",
    introduction:
      "Update embedded metadata that appears in PDF viewers and search results. Set a clear title, author name, and subject line before publishing or archiving your file.",
    steps: [
      "Upload the PDF you want to update.",
      "Fill in Document title, Author, and Subject fields as needed.",
      "Click Save Metadata to write the new properties locally.",
      "Download the updated PDF with revised document information.",
    ],
    features: [
      "Edit title, author, and subject metadata",
      "Preview changes before saving",
      "No visual content alteration",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "pdf-reader": {
    id: "pdf-reader",
    title: "PDF Reader Online - View PDF Files in Browser Free",
    description:
      "Read and preview PDF files online without downloading extra software. Page navigation and full-screen mode — private, in-browser viewing.",
    keywords: [
      "pdf reader online",
      "view pdf in browser",
      "open pdf online",
      "free pdf viewer",
    ],
    h1: "Free Online PDF Reader",
    introduction:
      "Open and read PDF documents directly in your browser. Navigate pages, zoom in full-screen mode, and keep files on your device — nothing is sent to a server.",
    steps: [
      "Upload the PDF you want to read.",
      "Click Open PDF to render the document in the viewer.",
      "Use previous/next controls or full-screen mode to browse pages.",
      "Download a copy anytime with the download button if needed.",
    ],
    features: [
      "Full-page PDF rendering in browser",
      "Previous/next page navigation",
      "Full-screen reading mode",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "number-pages": {
    id: "number-pages",
    title: "Number PDF Pages Online - Add Page Numbers Free",
    description:
      "Add page numbers to every page of a PDF online. Choose start page and first number — free, fast, and processed in your browser.",
    keywords: [
      "number pdf pages",
      "add page numbers pdf",
      "pdf pagination online",
      "page numbering tool",
    ],
    h1: "Add Page Numbers to PDF Online",
    introduction:
      "Make long reports and manuals easier to navigate with automatic page numbering. Preview each page, set where numbering begins, and export a professionally numbered PDF.",
    steps: [
      "Upload your PDF document.",
      "Set Start numbering on page and First page number options.",
      "Review the horizontal page preview row.",
      "Click Add Page Numbers, then download the numbered PDF.",
    ],
    features: [
      "Customizable start page and first number",
      "Bottom-center page number placement",
      "Horizontal page preview",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "crop-pdf": {
    id: "crop-pdf",
    title: "Crop PDF Online - Trim PDF Margins Free",
    description:
      "Crop white margins from PDF pages online. Set a margin percentage and download a tighter document — free and browser-based.",
    keywords: [
      "crop pdf",
      "trim pdf margins",
      "remove white border pdf",
      "pdf crop tool online",
    ],
    h1: "Crop PDF Margins Online",
    introduction:
      "Remove excess white space from scanned documents and slides. Apply a uniform crop percentage to every page for a cleaner, more compact PDF.",
    steps: [
      "Upload the PDF you want to crop.",
      "Enter a Crop margin (%) value — start with 5–10 for typical scans.",
      "Click Crop PDF to trim each page locally.",
      "Download the cropped PDF file.",
    ],
    features: [
      "Adjustable crop margin percentage",
      "Uniform crop applied to every page",
      "Ideal for scanned documents and slides",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "watermark-pdf": {
    id: "watermark-pdf",
    title: "Watermark PDF Online - Add Text or Image Watermark Free",
    description:
      "Add a text or image watermark to every PDF page online. Mark drafts as confidential or brand documents — processed locally for free.",
    keywords: [
      "watermark pdf",
      "add watermark to pdf",
      "pdf stamp online",
      "confidential pdf watermark",
    ],
    h1: "Add Watermark to PDF Online",
    introduction:
      "Protect drafts and internal documents with a visible watermark on every page. Use custom text or upload a PNG/JPG logo — all applied privately in your browser.",
    steps: [
      "Upload your PDF file.",
      "Choose Text watermark or Image watermark and enter text or select an image.",
      "Click Add Watermark to apply it to all pages.",
      "Download the watermarked PDF.",
    ],
    features: [
      "Text or image watermark support",
      "Custom watermark text and logo upload",
      "Applied to every page automatically",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "sign-pdf": {
    id: "sign-pdf",
    title: "Sign PDF Online - Add Text Signature Free",
    description:
      "Add a text signature to every page of a PDF online. Type your name and download — supports Latin and CJK characters, processed in-browser.",
    keywords: [
      "sign pdf online",
      "pdf signature",
      "add signature to pdf",
      "electronic sign pdf free",
    ],
    h1: "Sign PDF with Text Online",
    introduction:
      "Place a consistent text signature at the bottom of each page for approvals, forms, and internal sign-offs. Works with English, Chinese, and other Unicode names.",
    steps: [
      "Upload the PDF you need to sign.",
      "Enter your signature text (name or approval line).",
      "Click Sign PDF to apply the signature on every page.",
      "Download the signed PDF document.",
    ],
    features: [
      "Text-based electronic signature",
      "Support for Latin and CJK characters",
      "Signature placed on every page",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "unlock-pdf": {
    id: "unlock-pdf",
    title: "Unlock PDF Online - Remove PDF Password Free",
    description:
      "Remove password protection from a PDF you can open. Enter the current password and download an unlocked copy — browser-based and private.",
    keywords: [
      "unlock pdf",
      "remove pdf password",
      "pdf decryption online",
      "open protected pdf",
    ],
    h1: "Unlock Password-Protected PDF",
    introduction:
      "If you know the password to a PDF, create an unrestricted copy you can open without prompts. Ideal when you own the document but need a password-free version for sharing.",
    steps: [
      "Upload the password-protected PDF.",
      "Enter the current document password.",
      "Click Unlock PDF to decrypt locally in your browser.",
      "Download the unlocked PDF file.",
    ],
    features: [
      "Remove password from accessible PDFs",
      "One-click decryption",
      "Produces unrestricted downloadable copy",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "protect-pdf": {
    id: "protect-pdf",
    title: "Protect PDF Online - Add Password to PDF Free",
    description:
      "Password-protect a PDF online for free. Encrypt your document in the browser so only people with the password can open it.",
    keywords: [
      "protect pdf",
      "password protect pdf",
      "encrypt pdf online",
      "secure pdf file",
    ],
    h1: "Password Protect PDF Online",
    introduction:
      "Add encryption to sensitive contracts, tax forms, and personal records. Set a strong password and confirm it before downloading your protected PDF.",
    steps: [
      "Upload the PDF you want to secure.",
      "Enter a password and confirm it in both fields.",
      "Click Protect PDF to encrypt the file locally.",
      "Download your password-protected PDF and store the password safely.",
    ],
    features: [
      "Strong password-based encryption",
      "Password confirmation field",
      "Compatible with all standard PDF readers",
      "Local browser-based processing — no server upload",
    ],
    faqs: [
      {
        question: "Is it safe to use ToolVX online PDF tools? Will my files be uploaded?",
        answer:
          "Absolutely safe. ToolVX uses advanced client-side processing technology. Your PDF files stay entirely within your local browser throughout the entire process — never uploaded to any third-party server. Your privacy and business data are 100% protected.",
      },
      {
        question: "Is this PDF tool completely free? Are there any limitations?",
        answer:
          "Our tools are completely free for everyone — no hidden fees, no registration required. You can process your documents unlimited times with full efficiency.",
      },
      {
        question: "Why choose ToolVX over other large PDF converters?",
        answer:
          "Because we pursue zero-latency and lightweight processing. No complex software or plugins needed — just a browser, and you can process files in seconds on Windows, Mac, or mobile devices.",
      },
    ],
  },
  "redact-image-pdf": {
    id: redactToolSeo.id,
    title: redactToolSeo.title,
    description: redactToolSeo.description,
    keywords: redactToolSeo.keywords,
    h1: redactToolSeo.h1,
    introduction: redactToolSeo.introduction,
    steps: redactToolSeo.steps,
    faqs: redactToolFaqsForSchema(),
    features: [
      "PDF and image redaction",
      "Blur, mosaic, and solid blackout modes",
      "Multi-format support (PDF, JPG, PNG, GIF, WebP)",
      "Permanent redaction with local browser processing",
    ],
  },
};

export function getToolSeo(slug: string): ToolSEO | undefined {
  const seo = toolsSeoData[slug];
  if (!seo) return undefined;
  return enrichToolSeo(seo);
}

export function getToolSeoOrThrow(slug: string): ToolSEO {
  const seo = toolsSeoData[slug];
  if (!seo) {
    throw new Error(`Missing SEO data for tool slug: ${slug}`);
  }
  return enrichToolSeo(seo);
}

function enrichToolSeo(seo: ToolSEO): ToolSEO {
  return {
    ...seo,
    title: withFreeOnlineEn(seo.title),
    h1: withFreeOnlineEn(seo.h1),
  };
}
