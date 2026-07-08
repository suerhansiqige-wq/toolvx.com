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
    faqs: [
      {
        question: "Will compressing a PDF reduce text quality?",
        answer:
          "Text stays sharp because compression mainly optimizes embedded images and redundant structure. Balanced mode prioritizes visual fidelity; Strong and Maximum apply tighter limits for smaller file sizes.",
      },
      {
        question: "Is it safe to compress private documents here?",
        answer:
          "Yes. Files are processed entirely inside your browser and are never uploaded to our servers. Your documents never leave your computer during compression.",
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
    faqs: [
      {
        question: "What happens with large PDF files?",
        answer:
          "PDFs with more than 10 pages are converted and delivered as a ZIP file so downloads stay manageable. Smaller documents show an HD preview grid with one JPG per page.",
      },
      {
        question: "Are the JPG images high resolution?",
        answer:
          "Yes. Pages are rendered at high DPI inside your browser so text, charts, and photos remain clear in the exported images.",
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
    faqs: [
      {
        question: "Can I combine different image formats into one PDF?",
        answer:
          "Yes. You can mix JPG, PNG, and WebP files in a single session. Each image becomes one page in the final PDF.",
      },
      {
        question: "Are my images uploaded to a server?",
        answer:
          "No. Conversion runs entirely in your browser. Your photos and scans stay on your device from start to finish.",
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
    faqs: [
      {
        question: "Will formatting change after merging?",
        answer:
          "No. Each source PDF is embedded as-is, so original layouts, fonts, links, and bookmarks inside each file remain intact.",
      },
      {
        question: "How many PDFs can I merge at once?",
        answer:
          "You can add multiple PDFs in one session. Processing happens locally, so performance depends on your device and total file size.",
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
    faqs: [
      {
        question: "Can I split a PDF into single-page files?",
        answer:
          "Yes. Select the Every page (ZIP) option to export each page as its own PDF inside a ZIP download.",
      },
      {
        question: "Is quality affected when splitting?",
        answer:
          "No. Extracted files keep the same visual quality and internal structure as the original pages.",
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
    faqs: [
      {
        question: "Is the rotation permanent?",
        answer:
          "Yes. Once you download the file, the new orientation is saved in the PDF and displays correctly in any standard viewer.",
      },
      {
        question: "Does rotation work on scanned documents?",
        answer:
          "Absolutely. Rotating is ideal for scans and photos saved as PDFs that were captured in the wrong orientation.",
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
    faqs: [
      {
        question: "Can I delete multiple page ranges at once?",
        answer:
          "Yes. Use comma-separated numbers and ranges such as 1,3,5-7 to remove several sections in one operation.",
      },
      {
        question: "Does removing pages reduce file size?",
        answer:
          "Usually yes. Dropping unnecessary pages removes their content from the file, which typically lowers overall size.",
      },
    ],
  },
  "edit-pdf": {
    id: "edit-pdf",
    title: "Edit PDF Metadata Online - Update Title, Author & Subject Free",
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
    faqs: [
      {
        question: "What metadata can I change?",
        answer:
          "This tool updates standard document properties: title, author, and subject. Visual page editing requires a desktop PDF editor.",
      },
      {
        question: "Will editing metadata change how the PDF looks?",
        answer:
          "No. Metadata edits do not alter page content, layout, or fonts — only the hidden properties stored in the file header.",
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
    faqs: [
      {
        question: "Do I need to install Adobe Acrobat or another app?",
        answer:
          "No. The reader works in modern browsers on Windows, Mac, Linux, iOS, and Android without plugins.",
      },
      {
        question: "Is my document uploaded when I view it?",
        answer:
          "No. Rendering happens locally in your browser, so confidential PDFs stay on your machine.",
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
    faqs: [
      {
        question: "Can I start numbering from a specific page?",
        answer:
          "Yes. Pages before your chosen start page remain unnumbered, which is useful for cover sheets and table-of-contents sections.",
      },
      {
        question: "Where do page numbers appear?",
        answer:
          "Numbers are placed at the bottom center of each numbered page for a clean, consistent look.",
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
    faqs: [
      {
        question: "What does the crop margin percentage mean?",
        answer:
          "It trims that percentage from each edge of every page. Higher values remove more border; use small values first to avoid cutting content.",
      },
      {
        question: "Is cropping reversible?",
        answer:
          "The downloaded file is permanently cropped. Keep your original PDF if you may need uncropped pages later.",
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
    faqs: [
      {
        question: "Can I use my company logo as a watermark?",
        answer:
          "Yes. Switch to Image watermark and upload a PNG or JPG. The image is centered on each page at reduced opacity.",
      },
      {
        question: "Will a watermark make my PDF unreadable?",
        answer:
          "Watermarks are designed to be visible but unobtrusive — text and images remain readable underneath.",
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
    faqs: [
      {
        question: "Is this a legally binding digital signature?",
        answer:
          "This tool adds a visible text signature for convenience. For legally certified e-signatures, use a qualified provider that meets your jurisdiction's requirements.",
      },
      {
        question: "Can I sign in Chinese or other languages?",
        answer:
          "Yes. Non-Latin characters are rendered correctly using browser-based font rendering before embedding in the PDF.",
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
    faqs: [
      {
        question: "Can I unlock a PDF without the password?",
        answer:
          "No. You must provide the correct password. This tool is for documents you are authorized to access.",
      },
      {
        question: "Is unlocking secure?",
        answer:
          "Decryption runs entirely on your device. The password and file contents are not transmitted to any server.",
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
    faqs: [
      {
        question: "What happens if I forget the password?",
        answer:
          "Passwords cannot be recovered. Store your password in a secure manager before sharing the encrypted file.",
      },
      {
        question: "Does password protection work in all PDF readers?",
        answer:
          "Yes. Standard PDF encryption is supported by Adobe Acrobat, browser viewers, and most mobile PDF apps.",
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
