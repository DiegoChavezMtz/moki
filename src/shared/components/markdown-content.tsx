import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeMarkdown } from "../utils/markdown";

export function MarkdownContent({ content }: { content: string }) {
  return <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{normalizeMarkdown(content)}</ReactMarkdown></div>;
}
