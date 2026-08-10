import { Suspense } from "react";
import DraftEditor from "../../_components/DraftEditor";
import { StudioEditorSkeleton } from "../_components/StudioSkeletons";

export default function FocusModePage() {
	return (
		<Suspense fallback={<StudioEditorSkeleton />}>
			<DraftEditor />
		</Suspense>
	);
}
