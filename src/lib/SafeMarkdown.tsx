import React, { useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";

interface SafeMarkdownProps {
  children: string;
  className?: string;
}

function CopyButton({ text }: { text: string }) {
  const onCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
  }, [text]);
  return (
    <button type="button" onClick={onCopy} className="ml-auto mb-1 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground hover:opacity-90" aria-label="Copiar código">
      Copiar
    </button>
  );
}

export function SafeMarkdown({ children, className }: SafeMarkdownProps) {
  const sanitizeSchema = useMemo(() => {
    // allow className on code for syntax highlighting
    return {
      tagNames: undefined,
      attributes: { code: ["className"], span: ["className"], div: ["className"] },
    } as any;
  }, []);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeHighlight]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
          p: ({ node, ...props }) => <p className="text-sm leading-6 mb-2" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 mb-2" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 mb-2" {...props} />,
          li: ({ node, ...props }) => <li className="text-sm" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 italic text-muted-foreground text-sm my-2" {...props} />
          ),
          code: ({ className: cn, children: ch, ...props }: any) => {
            const inline = props.inline;
            if (inline) return <code className="px-1 py-0.5 rounded bg-muted text-xs" {...props}>{ch}</code>;
            const codeText = String(ch).replace(/\n$/, "");
            return (
              <div className="relative group">
                <div className="flex justify-end"><CopyButton text={codeText} /></div>
                <pre className="p-3 bg-muted rounded text-xs overflow-auto hljs"><code className={cn}>{ch}</code></pre>
              </div>
            );
          },
          a: ({ node, ...props }) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
          table: ({ node, ...props }) => <div className="overflow-x-auto"><table className="w-full text-sm" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="bg-muted" {...props} />,
          th: ({ node, ...props }) => <th className="text-left p-2 font-medium" {...props} />,
          td: ({ node, ...props }) => <td className="p-2 align-top" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default SafeMarkdown;
