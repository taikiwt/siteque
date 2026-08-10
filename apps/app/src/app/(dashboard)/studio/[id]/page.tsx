import { Suspense, use } from "react";
import DraftEditor from "../../_components/DraftEditor";
import { StudioEditorSkeleton } from "../_components/StudioSkeletons";

interface DraftPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default function DraftEditPage({ params }: DraftPageProps) {
	const { id } = use(params);

	return (
		<Suspense fallback={<StudioEditorSkeleton />}>
			<DraftEditor draftId={id} />
		</Suspense>
	);
}
