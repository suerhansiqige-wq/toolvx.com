/** English SEO source of truth for the standalone Image & PDF redaction tool page. */

export type RedactFAQItem = {
  qKey: string;
  aKey: string;
  question: string;
  answer: string;
};

export type RedactFeatureItem = {
  titleKey: string;
  bodyKey: string;
  title: string;
  body: string;
  iconAlt: string;
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
  featuresHeading: string;
  features: RedactFeatureItem[];
  faqHeading: string;
  faqs: RedactFAQItem[];
  appSchemaName: string;
};

export const redactToolSeo = {
  id: "redact-image-pdf",
  title: "Free PDF & Image Redaction Tool | Securely Redact PDF - ToolVX",
  description:
    "Securely redact PDF documents and images online for free. Permanently black out sensitive information with our private, browser-based redaction tool.",
  keywords: [
    "pdf redaction",
    "redact pdf online",
    "image redaction",
    "redact image online",
    "secure redaction",
    "redacted pdf",
    "black out pdf",
    "free pdf redaction tool",
  ],
  h1: "Online PDF and Image Redaction Tool",
  introduction:
    "Protect your privacy before sharing documents. Use our free redaction tool to securely redact PDF pages and images—blur, pixelate, or black out faces, credit card numbers, license plates, and IDs. All redaction runs 100% locally in your browser; your files never leave your device.",
  stepsHeading: "How to Redact a PDF Online",
  steps: [
    "Upload your PDF or image (JPG, PNG, GIF, WebP) by dragging it into the upload area or clicking to browse.",
    "Select sensitive areas and redact them—draw over text, faces, or IDs to apply blur, mosaic, or solid blackout redaction.",
    "Download your redacted PDF or image instantly. The exported file is permanently redacted and ready to share.",
  ],
  featuresHeading: "Why Choose Our Secure Redaction Tool",
  features: [
    {
      titleKey: "feature-0-title",
      bodyKey: "feature-0-body",
      title: "100% Browser-Based Redaction",
      body: "Every redaction runs inside your browser. No server uploads, no cloud storage—just private, secure image and PDF redaction on your device.",
      iconAlt: "Shield icon representing secure local redaction",
    },
    {
      titleKey: "feature-1-title",
      bodyKey: "feature-1-body",
      title: "Permanent PDF & Image Redaction",
      body: "When you redact and download, sensitive pixels and text are flattened into the file. Redacted content cannot be reversed or recovered.",
      iconAlt: "Lock icon representing permanent redaction",
    },
    {
      titleKey: "feature-2-title",
      bodyKey: "feature-2-body",
      title: "Multi-Format Redaction Support",
      body: "Redact multi-page PDFs and images in JPG, PNG, GIF, and WebP. One tool for secure document and photo redaction workflows.",
      iconAlt: "Document icon representing PDF and image redaction formats",
    },
  ],
  faqHeading: "Frequently Asked Questions about Redaction",
  faqs: [
    {
      qKey: "faq-q-1",
      aKey: "faq-a-1",
      question: "Is PDF redaction permanent?",
      answer:
        "Yes. When you redact a PDF and download the file, our tool permanently flattens the masked areas into the document. The original text and pixels underneath are destroyed, so the redaction cannot be undone or recovered.",
    },
    {
      qKey: "faq-q-2",
      aKey: "faq-a-2",
      question: "How do I redact an image online?",
      answer:
        "Upload your JPG, PNG, GIF, or WebP image, then drag over faces, license plates, or any sensitive area. Choose blur, mosaic, or solid blackout, and download your redacted image—all without installing software.",
    },
    {
      qKey: "faq-q-3",
      aKey: "faq-a-3",
      question: "Is this redaction tool private and secure?",
      answer:
        "Absolutely. This is a browser-based redaction tool. Your PDFs and images are processed locally with client-side technology—nothing is uploaded to our servers, making it ideal for confidential contracts and personal documents.",
    },
  ],
  appSchemaName: "PDF & Image Redaction Tool",
} satisfies RedactToolSEO;

export function getRedactToolSeo(): RedactToolSEO {
  return redactToolSeo;
}

export function redactToolFaqsForSchema() {
  return redactToolSeo.faqs.map(({ question, answer }) => ({ question, answer }));
}
