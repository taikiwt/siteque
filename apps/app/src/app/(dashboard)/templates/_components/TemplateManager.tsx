"use client";

import type { Template } from "@sitecue/shared";
import { APP_LIMITS } from "@sitecue/shared";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "@/components/ui/button";
import { CustomLink as Link } from "@/components/ui/custom-link";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SWRBoundary } from "@/components/ui/swr-boundary";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
	useCreateTemplate,
	useDeleteTemplate,
	useFetchTemplates,
	useUpdateTemplate,
} from "@/hooks/useTemplatesQuery";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/useLayoutStore";

export function TemplateManager({
	initialTemplates,
	selectedId,
}: {
	initialTemplates?: Template[];
	selectedId?: string | null;
}) {
	const isSidebarOpen = useLayoutStore((state) => state.isSidebarOpen);
	const router = useRouter();
	const searchParams = useSearchParams();
	const isDesktop = useMediaQuery("(min-width: 768px)");

	const effectiveSelectedId =
		selectedId !== undefined ? selectedId : searchParams.get("id") || null;

	const { data: templates, isLoading } = useFetchTemplates(initialTemplates);

	const activeTemplates = templates ?? [];

	const createTemplateMutation = useCreateTemplate();
	const updateTemplateMutation = useUpdateTemplate();
	const deleteTemplateMutation = useDeleteTemplate();

	// Form State
	const activeTemplate = activeTemplates.find(
		(t) => t.id === effectiveSelectedId,
	);
	const isNew = effectiveSelectedId === "new";
	const isDrawerOpen = !isDesktop && (!!activeTemplate || isNew);

	const [name, setName] = useState("");
	const [maxLength, setMaxLength] = useState<string>("");
	const [boilerplate, setBoilerplate] = useState("");
	const [weavePrompt, setWeavePrompt] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const boilerplateCharCount = boilerplate.length;
	const weavePromptCharCount = weavePrompt.length;

	const isBoilerplateNearLimit =
		boilerplateCharCount >= APP_LIMITS.MAX_TEMPLATE_LENGTH * 0.9;
	const isBoilerplateOverLimit =
		boilerplateCharCount > APP_LIMITS.MAX_TEMPLATE_LENGTH;

	const isWeavePromptNearLimit =
		weavePromptCharCount >= APP_LIMITS.MAX_TEMPLATE_LENGTH * 0.9;
	const isWeavePromptOverLimit =
		weavePromptCharCount > APP_LIMITS.MAX_TEMPLATE_LENGTH;

	const isOverLimit = isBoilerplateOverLimit || isWeavePromptOverLimit;

	// Sync form when selection changes
	useEffect(() => {
		if (activeTemplate) {
			setName(activeTemplate.name);
			setMaxLength(
				activeTemplate.max_length ? activeTemplate.max_length.toString() : "",
			);
			setBoilerplate(activeTemplate.boilerplate || "");
			setWeavePrompt(activeTemplate.weave_prompt || "");
		} else if (isNew) {
			setName("");
			setMaxLength("");
			setBoilerplate("");
			setWeavePrompt("");
		}
	}, [activeTemplate, isNew]);

	const isDirty = activeTemplate
		? name !== activeTemplate.name ||
			maxLength !== (activeTemplate.max_length?.toString() || "") ||
			boilerplate !== (activeTemplate.boilerplate || "") ||
			weavePrompt !== (activeTemplate.weave_prompt || "")
		: isNew
			? name !== "" || boilerplate !== "" || weavePrompt !== ""
			: false;

	useUnsavedChanges(isDirty);

	const handleSave = async () => {
		if (!name.trim()) return;
		setIsSaving(true);

		const payload = {
			name: name.trim(),
			max_length: maxLength ? Number.parseInt(maxLength, 10) : null,
			boilerplate: boilerplate.trim() || null,
			weave_prompt: weavePrompt.trim() || null,
		};

		try {
			if (isNew) {
				const data = await createTemplateMutation.mutateAsync(payload);
				router.push(`/templates?id=${data.id}`);
			} else if (activeTemplate) {
				await updateTemplateMutation.mutateAsync({
					id: activeTemplate.id,
					updates: payload,
				});
			}
			router.refresh();
		} catch (err) {
			console.error("Failed to save template:", err);
			alert("Failed to save template.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!window.confirm("Are you sure you want to delete this template?"))
			return;

		if (effectiveSelectedId === id) router.push("/templates");

		try {
			await deleteTemplateMutation.mutateAsync(id);
		} catch (error) {
			console.error("Delete failed", error);
			router.refresh();
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) router.push("/templates");
	};

	const EditorContent = (
		<div className="max-w-2xl w-full mx-auto space-y-6">
			<div className="flex items-center justify-between mb-8">
				<h2 className="text-2xl font-bold">
					{isNew ? "Create Template" : "Edit Template"}
				</h2>
				<Button
					onClick={handleSave}
					disabled={isSaving || !name.trim() || isOverLimit}
					type="button"
				>
					{isSaving ? "Saving..." : "Save Template"}
				</Button>
			</div>

			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="template-name">Template Name</Label>
					<Input
						id="template-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. X Thread, Daily Report"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="max-length">Max Length (Optional)</Label>
					<Input
						id="max-length"
						type="number"
						value={maxLength}
						onChange={(e) => setMaxLength(e.target.value)}
						placeholder="e.g. 140"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="boilerplate">
						Boilerplate / Initial Text (Optional)
					</Label>
					<TextareaAutosize
						id="boilerplate"
						minRows={4}
						value={boilerplate}
						onChange={(e) => setBoilerplate(e.target.value)}
						className="w-full rounded-lg border border-base-border bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-base-border"
						placeholder="# Target Audience&#10;&#10;# Key Message"
					/>
					{isBoilerplateNearLimit && (
						<div className="flex justify-end">
							<span
								className={cn(
									"text-[10px] font-bold",
									isBoilerplateOverLimit ? "text-note-alert" : "text-note-idea",
								)}
							>
								{boilerplateCharCount.toLocaleString()} /{" "}
								{APP_LIMITS.MAX_TEMPLATE_LENGTH.toLocaleString()}
							</span>
						</div>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="weave-prompt">
						Weave Prompt (System Prompt for AI) (Optional)
					</Label>
					<TextareaAutosize
						id="weave-prompt"
						minRows={3}
						value={weavePrompt}
						onChange={(e) => setWeavePrompt(e.target.value)}
						className="w-full rounded-lg border border-base-border bg-base-surface p-3 text-sm focus:outline-none font-mono text-xs"
						placeholder="Provide context for the AI when generating from this template."
					/>
					{isWeavePromptNearLimit && (
						<div className="flex justify-end">
							<span
								className={cn(
									"text-[10px] font-bold",
									isWeavePromptOverLimit ? "text-note-alert" : "text-note-idea",
								)}
							>
								{weavePromptCharCount.toLocaleString()} /{" "}
								{APP_LIMITS.MAX_TEMPLATE_LENGTH.toLocaleString()}
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);

	return (
		<div className="flex h-screen overflow-hidden bg-base-bg text-action">
			{/* List Pane */}
			<div className="w-full md:w-80 flex flex-col border-r border-base-border bg-base-surface">
				<div className="flex-1 overflow-y-auto">
					<div
						className={cn(
							"p-4 border-b border-base-border flex items-center justify-between sticky top-0 bg-base-surface z-20 transition-all duration-300",
							!isSidebarOpen && "md:pl-16",
						)}
					>
						<div className="flex items-center gap-2">
							<Link
								href="/"
								className="inline-flex items-center justify-center h-7 w-7 rounded-[min(var(--radius-md),12px)] hover-safe:bg-muted hover-safe:text-foreground transition-colors"
								aria-label="Go back to Launchpad"
							>
								<ArrowLeft className="w-4 h-4 text-action" aria-hidden="true" />
							</Link>
							<h1 className="font-bold text-lg">Templates</h1>
						</div>
						<Link
							href="/templates?id=new"
							className="inline-flex items-center justify-center h-7 w-7 rounded-[min(var(--radius-md),12px)] hover-safe:bg-muted transition-colors text-action"
							aria-label="New Template"
						>
							<Plus className="w-4 h-4" aria-hidden="true" />
						</Link>
					</div>

					<div className="px-2 py-4 space-y-1">
						<Suspense
							fallback={
								<div className="space-y-2">
									{["tpl-skel-1", "tpl-skel-2", "tpl-skel-3", "tpl-skel-4"].map(
										(id) => (
											<div
												key={id}
												className="flex items-center justify-between px-3 py-2 rounded-lg h-9"
											>
												<Skeleton className="h-4 w-2/3 rounded-md" />
											</div>
										),
									)}
								</div>
							}
						>
							<SWRBoundary
								data={templates}
								isLoading={isLoading && !templates}
								fallback={
									<div
										className="space-y-2"
										data-testid="template-list-skeleton"
									>
										{[
											"tpl-skel-1",
											"tpl-skel-2",
											"tpl-skel-3",
											"tpl-skel-4",
										].map((id) => (
											<div
												key={id}
												className="flex items-center justify-between px-3 py-2 rounded-lg h-9"
											>
												<Skeleton className="h-4 w-2/3 rounded-md" />
											</div>
										))}
									</div>
								}
							>
								{(templateList) =>
									templateList.map((t) => (
										<div
											key={t.id}
											className={`flex items-center justify-between px-3 py-2 rounded-lg group ${effectiveSelectedId === t.id ? "bg-base-bg shadow-sm" : "hover-safe:bg-base-bg/50"}`}
										>
											<Link
												href={`/templates?id=${t.id}`}
												className="flex-1 truncate text-sm font-medium"
											>
												{t.name}
											</Link>
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={() => handleDelete(t.id)}
												className="opacity-100 pointer-fine:opacity-0 group-hover-safe:opacity-100 text-gray-400 hover-safe:text-note-alert transition-opacity"
												type="button"
												aria-label={`Delete ${t.name}`}
											>
												<Trash2 className="w-3 h-3" aria-hidden="true" />
											</Button>
										</div>
									))
								}
							</SWRBoundary>
						</Suspense>
					</div>
				</div>
			</div>

			{/* Desktop Editor Pane */}
			{isDesktop && (
				<div className="flex-1 flex flex-col overflow-y-auto p-8">
					<Suspense
						fallback={
							<div className="max-w-2xl w-full mx-auto space-y-6">
								<Skeleton className="h-8 w-1/3 rounded-md" />
								<Skeleton className="h-24 w-full rounded-md" />
							</div>
						}
					>
						<SWRBoundary
							data={templates}
							isLoading={isLoading && !templates}
							fallback={
								<div className="max-w-2xl w-full mx-auto space-y-6">
									<Skeleton className="h-8 w-1/3 rounded-md" />
									<Skeleton className="h-24 w-full rounded-md" />
								</div>
							}
						>
							{() =>
								activeTemplate || isNew ? (
									EditorContent
								) : (
									<div className="flex-1 flex items-center justify-center text-gray-400">
										Select a template to edit or create a new one.
									</div>
								)
							}
						</SWRBoundary>
					</Suspense>
				</div>
			)}

			{/* Mobile Editor Drawer */}
			{!isDesktop && (
				<Drawer open={isDrawerOpen} onOpenChange={handleOpenChange}>
					<DrawerContent className="!mt-0 !h-[100dvh] !max-h-none rounded-t-2xl rounded-b-none p-0 flex flex-col overflow-hidden bg-base-bg border-none">
						<DrawerHeader className="sr-only">
							<DrawerTitle>
								{isNew ? "Create Template" : "Edit Template"}
							</DrawerTitle>
							<DrawerDescription>Edit the template details</DrawerDescription>
						</DrawerHeader>

						{/* Mobile Header with Back Button */}
						<div className="shrink-0 flex items-center px-4 py-2 border-b border-base-border mt-2">
							<Button
								onClick={() => handleOpenChange(false)}
								type="button"
								variant="ghost"
								className="gap-2 px-2 -ml-2 text-action hover-safe:bg-base-surface cursor-pointer"
							>
								<ArrowLeft aria-hidden="true" className="w-5 h-5" />
								Templates
							</Button>
						</div>

						{/* Scrollable Content Area */}
						<div className="flex-1 overflow-y-auto p-4">
							<Suspense
								fallback={
									<div className="max-w-2xl w-full mx-auto space-y-6">
										<Skeleton className="h-8 w-1/3 rounded-md" />
										<Skeleton className="h-24 w-full rounded-md" />
									</div>
								}
							>
								<SWRBoundary
									data={templates}
									isLoading={isLoading && !templates}
									fallback={
										<div className="max-w-2xl w-full mx-auto space-y-6">
											<Skeleton className="h-8 w-1/3 rounded-md" />
											<Skeleton className="h-24 w-full rounded-md" />
										</div>
									}
								>
									{() => EditorContent}
								</SWRBoundary>
							</Suspense>
						</div>
					</DrawerContent>
				</Drawer>
			)}
		</div>
	);
}
