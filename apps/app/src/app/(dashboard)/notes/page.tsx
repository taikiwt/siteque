import { Suspense } from "react";
import { NotesContainer } from "./_components/NotesContainer";
import { NotesContainerSkeleton } from "./_components/NotesSkeletons";

export default function NotesPage() {
	return (
		<Suspense fallback={<NotesContainerSkeleton />}>
			<NotesContainer />
		</Suspense>
	);
}
