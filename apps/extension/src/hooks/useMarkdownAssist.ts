import type React from "react";

export function useMarkdownAssist() {
	const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// 🛡️ IME入力中およびChromiumの1打鍵目(keyCode 229 / key Process)を完全遮断
		if (e.nativeEvent.isComposing || e.keyCode === 229 || e.key === "Process") {
			return;
		}

		const textarea = e.currentTarget;
		const { value, selectionStart, selectionEnd } = textarea;

		// 履歴を保護しながら指定区間のテキストを書き換えるインナークロージャヘルパー
		const insertText = (
			text: string,
			start: number,
			end: number,
			selectStart: number,
			selectEnd: number,
			isDelete = false,
		) => {
			textarea.setSelectionRange(start, end);
			let success = false;
			const command = isDelete ? "delete" : "insertText";

			if (document.queryCommandSupported(command)) {
				success = document.execCommand(
					command,
					false,
					isDelete ? undefined : text,
				);
			}
			if (!success) {
				textarea.setRangeText(text, start, end, "end");
				textarea.dispatchEvent(new Event("input", { bubbles: true }));
			}
			textarea.setSelectionRange(selectStart, selectEnd);
		};

		// --- 1. Tabキーによるインデント補助 (スペース2つ) ---
		if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			const isShift = e.shiftKey;

			if (selectionStart !== selectionEnd) {
				// 複数行選択時のインデント/アウトデント一括処理
				const startOfSelection =
					value.lastIndexOf("\n", selectionStart - 1) + 1;
				const endOfSelection = value.indexOf("\n", selectionEnd);
				const targetEnd = endOfSelection === -1 ? value.length : endOfSelection;
				const selectedChunk = value.slice(startOfSelection, targetEnd);
				const lines = selectedChunk.split("\n");

				let diffStart = 0;
				let diffEnd = 0;

				const newLines = lines.map((line, idx) => {
					if (isShift) {
						let removed = 0;
						let newLine = line;
						if (line.startsWith("  ")) {
							removed = 2;
							newLine = line.slice(2);
						} else if (line.startsWith(" ") || line.startsWith("\t")) {
							removed = 1;
							newLine = line.slice(1);
						}
						if (idx === 0) diffStart -= removed;
						diffEnd -= removed;
						return newLine;
					} else {
						if (idx === 0) diffStart += 2;
						diffEnd += 2;
						return `  ${line}`;
					}
				});

				const newChunk = newLines.join("\n");
				insertText(
					newChunk,
					startOfSelection,
					targetEnd,
					Math.max(startOfSelection, selectionStart + diffStart),
					Math.max(startOfSelection, selectionEnd + diffEnd),
				);
			} else {
				// 単一カーソル時の処理
				const currentLineStart =
					value.lastIndexOf("\n", selectionStart - 1) + 1;
				const currentLineEnd = value.indexOf("\n", selectionStart);
				const targetLineEnd =
					currentLineEnd === -1 ? value.length : currentLineEnd;
				const fullLine = value.slice(currentLineStart, targetLineEnd);
				const currentLineToCursor = value.slice(
					currentLineStart,
					selectionStart,
				);

				// リストマーカーを内包する行（行頭にスペースやタブがあっても許容する）かどうかの判定
				const hasListMarker = /^[ \t]*(?:[-*]|\d+\.)\s/.test(fullLine);

				if (hasListMarker) {
					// 💡 リスト行でTabが押されたら、カーソル位置に関わらず「常に行頭を操作してリスト記号ごとインデント（入れ子化）」を保証する
					if (isShift) {
						const match = fullLine.match(/^( {1,2}|\t)/);
						if (match) {
							const removeLen = match[0].length;
							insertText(
								"",
								currentLineStart,
								currentLineStart + removeLen,
								selectionStart - removeLen,
								selectionStart - removeLen,
								true,
							);
						}
					} else {
						insertText(
							"  ",
							currentLineStart,
							currentLineStart,
							selectionStart + 2,
							selectionStart + 2,
						);
					}
				} else {
					// 通常行の処理
					if (isShift) {
						const match = currentLineToCursor.match(/^( {1,2}|\t)/);
						if (match) {
							const removeLen = match[0].length;
							insertText(
								"",
								currentLineStart,
								currentLineStart + removeLen,
								selectionStart - removeLen,
								selectionStart - removeLen,
								true,
							);
						}
					} else {
						insertText(
							"  ",
							selectionStart,
							selectionStart,
							selectionStart + 2,
							selectionStart + 2,
						);
					}
				}
			}
			return;
		}

		// --- 2. Enterキーによるオートバレット・自動改行インデント ---
		if (
			e.key === "Enter" &&
			!e.shiftKey &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey
		) {
			const currentLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
			const currentLine = value.slice(currentLineStart, selectionStart);

			const indentMatch = currentLine.match(/^[ \t]+/);
			const indent = indentMatch ? indentMatch[0] : "";
			const lineWithoutIndent = currentLine.slice(indent.length);

			const bulletMatch = lineWithoutIndent.match(/^(?:[-*]|\d+\.)\s/);

			if (bulletMatch) {
				e.preventDefault();
				const marker = bulletMatch[0];
				const contentAfterMarker = lineWithoutIndent
					.slice(marker.length)
					.trim();

				// 💡 離脱制御: 空のリストマーカーでEnterを押したら、余計なマーカー行を「改行コード（\n）」へ置換し、カーソルを次行の先頭へ美しくスライド着地させる
				if (contentAfterMarker === "") {
					insertText(
						"\n",
						currentLineStart,
						selectionStart,
						currentLineStart + 1,
						currentLineStart + 1,
					);
					return;
				}

				let nextMarker = marker;
				const numMatch = marker.match(/^(\d+)\.\s/);
				if (numMatch) {
					const nextNum = parseInt(numMatch[1], 10) + 1;
					nextMarker = `${nextNum}. `;
				}

				insertText(
					`\n${indent}${nextMarker}`,
					selectionStart,
					selectionStart,
					selectionStart + indent.length + nextMarker.length + 1,
					selectionStart + indent.length + nextMarker.length + 1,
				);
				return;
			}

			if (indent.length > 0) {
				e.preventDefault();
				if (indent === currentLine) {
					insertText(
						"\n",
						currentLineStart,
						selectionStart,
						currentLineStart + 1,
						currentLineStart + 1,
					);
				} else {
					insertText(
						`\n${indent}`,
						selectionStart,
						selectionStart,
						selectionStart + indent.length + 1,
						selectionStart + indent.length + 1,
					);
				}
				return;
			}
		}

		// --- 3. ブラケット・ペア・クローズ（記号自動閉じ） & 先読み貫通ガード ---
		// 💡 バッククォート (`) に加え、変数名やURLで多用されるアンダースコア (_) も除外（引き算）
		const bracketPairs: Record<string, string> = {
			"[": "]",
			"(": ")",
			'"': '"',
			"'": "'",
			"*": "*",
		};

		const closeChars = ["]", ")", '"', "'", "*"];

		if (closeChars.includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
			const nextChar = value.charAt(selectionStart);
			if (nextChar === e.key) {
				e.preventDefault();
				textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
				return;
			}
		}

		if (
			bracketPairs[e.key] !== undefined &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey
		) {
			const char = e.key;
			const closeChar = bracketPairs[char];

			e.preventDefault();
			if (selectionStart !== selectionEnd) {
				const selectedText = value.slice(selectionStart, selectionEnd);
				insertText(
					`${char}${selectedText}${closeChar}`,
					selectionStart,
					selectionEnd,
					selectionStart + 1,
					selectionEnd + 1,
				);
			} else {
				insertText(
					`${char}${closeChar}`,
					selectionStart,
					selectionStart,
					selectionStart + 1,
					selectionStart + 1,
				);
			}
			return;
		}

		// --- 4. 連動削除 (Backspace時に空の括弧ペアであれば連動削除) ---
		if (
			e.key === "Backspace" &&
			selectionStart === selectionEnd &&
			selectionStart > 0
		) {
			const prevChar = value.charAt(selectionStart - 1);
			const nextChar = value.charAt(selectionStart);
			// 💡 `_` も連動削除ペアから除外
			const matchingPairs = ["()", "[]", '""', "''", "**"];

			if (matchingPairs.includes(prevChar + nextChar)) {
				e.preventDefault();
				insertText(
					"",
					selectionStart - 1,
					selectionStart + 1,
					selectionStart - 1,
					selectionStart - 1,
					true,
				);
			}
		}
	};

	const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
		const textarea = e.currentTarget;
		const { value, selectionStart, selectionEnd } = textarea;

		if (selectionStart !== selectionEnd) {
			const pastedText = e.clipboardData.getData("text");
			const isUrl = /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(pastedText.trim());

			if (isUrl) {
				e.preventDefault();
				const selectedText = value.slice(selectionStart, selectionEnd);
				const mdLink = `[${selectedText}](${pastedText.trim()})`;

				textarea.setSelectionRange(selectionStart, selectionEnd);
				let success = false;
				if (document.queryCommandSupported("insertText")) {
					success = document.execCommand("insertText", false, mdLink);
				}
				if (!success) {
					textarea.setRangeText(mdLink, selectionStart, selectionEnd, "end");
					textarea.dispatchEvent(new Event("input", { bubbles: true }));
				}
				textarea.setSelectionRange(
					selectionStart,
					selectionStart + mdLink.length,
				);
			}
		}
	};

	return { onKeyDown, onPaste };
}
