import { Check, Copy, ExternalLink } from "lucide-react";
import type React from "react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import diff from "react-syntax-highlighter/dist/esm/languages/prism/diff";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import lua from "react-syntax-highlighter/dist/esm/languages/prism/lua";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import html from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// --- Register Languages ---
// JS/TS & React
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("tsx", tsx);

// Web & Markup
SyntaxHighlighter.registerLanguage("html", html);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("md", markdown);

// Config & Data
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("toml", toml);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("yml", yaml);
SyntaxHighlighter.registerLanguage("lua", lua);

// Backend & DB & Others
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("diff", diff);

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

// 💡 モジュールスコープに保持する構文解析キャッシュ（コンポーネントの再マウントでも破棄されない）
const MARKDOWN_CACHE_LIMIT = 200;
const markdownCache = new Map<string, React.ReactNode>();

function CodeBlock({
	children,
	className,
	node: _node,
	...rest
}: {
	children?: React.ReactNode;
	className?: string;
	node?: unknown;
}) {
	const [isCopied, setIsCopied] = useState(false);
	const match = /language-(\w+)/.exec(className || "");
	const isInline = !match && !String(children).includes("\n");

	if (isInline) {
		return (
			<code
				{...rest}
				className="px-1.5 py-0.5 bg-base-surface text-action rounded font-['Hack'] monospace text-xs"
			>
				{children}
			</code>
		);
	}

	const codeString = String(children).replace(/\n$/, "");
	const language = match ? match[1] : "";

	const handleCopy = () => {
		navigator.clipboard.writeText(codeString);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	return (
		<div className="relative group my-3">
			<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-base-surface/90 rounded shadow-sm border border-base-border z-1">
				<button
					type="button"
					onClick={handleCopy}
					className="p-1.5 text-muted-foreground hover:text-action flex items-center justify-center transition-colors cursor-pointer"
					title="Copy code"
				>
					{isCopied ? (
						<Check className="w-3.5 h-3.5 text-note-info" />
					) : (
						<Copy className="w-3.5 h-3.5" />
					)}
				</button>
			</div>
			<div className="rounded-lg overflow-hidden text-xs font-['Hack'] monospace leading-relaxed relative">
				<SyntaxHighlighter
					{...rest}
					style={oneLight}
					language={language}
					PreTag="div"
					customStyle={{
						margin: 0,
						padding: "0.75rem",
						fontFamily: "var(--font-hack, 'Hack', monospace)",
					}}
					codeTagProps={{
						style: { fontFamily: "inherit" },
					}}
					wrapLongLines={true}
				>
					{codeString}
				</SyntaxHighlighter>
			</div>
		</div>
	);
}

export default function MarkdownRenderer({
	content,
	className = "",
}: MarkdownRendererProps) {
	if (!content) return null;

	// 1. キャッシュが存在すれば 0ms で即時返却
	if (markdownCache.has(content)) {
		return (
			<div
				className={`prose prose-sm prose-neutral max-w-none ${className} break-words [&>*:first-child]:mt-0`}
			>
				{markdownCache.get(content)}
			</div>
		);
	}

	// 2. 未キャッシュの場合のみ新規パース・描画要素を構築
	const parsedElement = (
		<ReactMarkdown
			remarkPlugins={[remarkGfm, remarkBreaks]}
			components={{
				// Header Styling
				h1: ({ children }) => (
					<h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
				),
				h2: ({ children }) => (
					<h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
				),
				h3: ({ children }) => (
					<h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
				),

				// List Styling
				ul: ({ children }) => (
					<ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
				),
				ol: ({ children }) => (
					<ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
				),
				li: ({ children, className }) => {
					// Check if this li contains a task list checkbox (remark-gfm adds 'task-list-item' class)
					const isTaskListItem = className?.includes("task-list-item");
					return (
						<li
							className={`text-sm leading-relaxed ${
								isTaskListItem ? "flex items-start gap-2 list-none -ml-4" : ""
							}`}
						>
							{children}
						</li>
					);
				},
				input: (props) => {
					if (props.type === "checkbox") {
						return (
							<input
								type="checkbox"
								checked={props.checked}
								disabled={props.disabled}
								readOnly
								className="appearance-none w-4 h-4 min-w-4 min-h-4 border border-base-border rounded bg-base-surface checked:bg-action checked:border-action focus:ring-1 focus:ring-action/50 focus:outline-none transition ease-in-out duration-150 cursor-pointer mt-0.5 disabled:opacity-60 disabled:cursor-not-allowed relative
                  checked:after:content-[''] checked:after:absolute checked:after:left-1.25 checked:after:top-0.5 checked:after:w-1.25 checked:after:h-2.25 checked:after:border-action-text checked:after:border-r-2 checked:after:border-b-2 checked:after:rotate-45"
							/>
						);
					}
					return <input {...props} />;
				},

				// Text Styling
				p: ({ children }) => (
					<p className="mb-2 text-sm leading-relaxed">{children}</p>
				),
				strong: ({ children }) => (
					<strong className="font-semibold text-action">{children}</strong>
				),
				em: ({ children }) => (
					<em className="italic text-muted-foreground">{children}</em>
				),
				blockquote: ({ children }) => (
					<blockquote className="border-l-4 border-base-border pl-4 py-1 my-2 bg-base-bg italic text-muted-foreground rounded-r">
						{children}
					</blockquote>
				),

				// Link Styling - Force external new tab
				a: ({ href, children }) => (
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-action hover:text-action-hover underline break-all"
					>
						{children}
						<ExternalLink className="w-3 h-3 inline-block ml-1 align-text-bottom text-action" />
					</a>
				),

				// Code Styling
				code: CodeBlock,

				// Table Styling
				table: ({ children }) => (
					<div className="overflow-x-auto my-3 border rounded border-base-border">
						<table className="min-w-full divide-y divide-base-border text-sm">
							{children}
						</table>
					</div>
				),
				thead: ({ children }) => (
					<thead className="bg-base-bg">{children}</thead>
				),
				tbody: ({ children }) => (
					<tbody className="divide-y divide-base-border bg-base-surface">
						{children}
					</tbody>
				),
				tr: ({ children }) => <tr>{children}</tr>,
				th: ({ children }) => (
					<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
						{children}
					</th>
				),
				td: ({ children }) => (
					<td className="px-3 py-2 text-sm text-action border-r border-base-border last:border-r-0">
						{children}
					</td>
				),
			}}
		>
			{content}
		</ReactMarkdown>
	);

	// 3. LRU キャッシュ更新（200件を超えたら古いエントリーを破棄）
	if (markdownCache.size >= MARKDOWN_CACHE_LIMIT) {
		const firstKey = markdownCache.keys().next().value;
		if (firstKey !== undefined) {
			markdownCache.delete(firstKey);
		}
	}
	markdownCache.set(content, parsedElement);

	return (
		<div
			className={`prose prose-sm prose-neutral max-w-none ${className} break-words [&>*:first-child]:mt-0`}
		>
			{parsedElement}
		</div>
	);
}
