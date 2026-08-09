import { Suspense } from "react";
import { TemplateManager } from "./_components/TemplateManager";
import { TemplatesPageSkeleton } from "./_components/TemplatesSkeletons";

export default function TemplatesPage() {
	return (
		<Suspense fallback={<TemplatesPageSkeleton />}>
			<TemplateManager />
		</Suspense>
	);
}
