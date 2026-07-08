/** English SEO source of truth for the standalone Image & PDF redaction tool page. */

import { withFreeOnlineEn } from "@/utils/seo-free-online";

export type RedactFAQItem = {
  qKey: string;
  aKey: string;
  question: string;
  answer: string;
};

export type RedactToolSEO = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  introduction: string;
  stepsHeading: string;
  steps: string[];
  faqHeading: string;
  faqs: RedactFAQItem[];
};

export const redactToolSeo = {
  id: "redact-image-pdf",
  title: "Redact PDF & Images Online - Free Blur & Mask Sensitive Data",
  description:
    "Free web-based tool to redact, blur, or mask faces, ID numbers, and credentials in PDFs and images (JPG, PNG). 100% private, processed locally in your browser.",
  keywords: [
    "redact pdf online",
    "blur face in image",
    "mask sensitive data pdf",
    "free pdf censor tool",
    "online image redaction",
  ],
  h1: "Online Image & PDF Redaction Tool",
  introduction:
    "Protect your privacy before sharing documents. Securely blur, pixelate, or mask faces, credit card numbers, license plates, and IDs. All file processing runs 100% locally inside your web browser—your data never leaves your device.",
  stepsHeading: "How to Redact PDF and Images Online",
  steps: [
    "Drag and drop your PDF file or image (JPG, PNG, GIF, WebP) into the upload box.",
    "Click and drag over the sensitive text, face, or ID card area to apply a blur, mosaic, or solid black mask.",
    "Adjust the opacity or box size to ensure the private data is fully covered.",
    "Click 'Download' to save your permanently redacted and secure file instantly.",
  ],
  faqHeading: "Frequently Asked Questions",
  faqs: [
    {
      qKey: "faq-q-1",
      aKey: "faq-a-1",
      question: "Is it safe to upload my confidential documents here?",
      answer:
        "Yes, it is 100% secure. This tool utilizes client-side web technologies (HTML5/WebAssembly) to process files entirely inside your local browser. Your data is never uploaded to any external servers, ensuring absolute privacy.",
    },
    {
      qKey: "faq-q-2",
      aKey: "faq-a-2",
      question: "What file formats does this online redaction tool support?",
      answer:
        "We support a wide range of file types including PDF documents, as well as popular image formats like JPG, JPEG, PNG, GIF, and WebP.",
    },
    {
      qKey: "faq-q-3",
      aKey: "faq-a-3",
      question: "Will the blurred or blacked-out content remain reversible?",
      answer:
        "No. Once you apply the blur or solid mask and click download, our tool flattens the file layers permanently. The underlying original pixel data or text streams are permanently deleted, making it impossible for anyone to reverse-engineer or reveal the hidden information.",
    },
  ],
} satisfies RedactToolSEO;

export function getRedactToolSeo(): RedactToolSEO {
  return {
    ...redactToolSeo,
    title: withFreeOnlineEn(redactToolSeo.title),
    h1: withFreeOnlineEn(redactToolSeo.h1),
  };
}

export function redactToolFaqsForSchema() {
  return redactToolSeo.faqs.map(({ question, answer }) => ({ question, answer }));
}
