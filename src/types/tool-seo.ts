export type SeoBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean };

export type SeoSection = {
  heading: string;
  blocks: SeoBlock[];
};
