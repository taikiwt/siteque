import { Suspense, use } from "react";
import { DiaryStudioClient } from "./_components/DiaryStudioClient";

interface Props {
	params: Promise<{ date: string }>;
}

export default function DiaryStudioPage({ params }: Props) {
	const { date } = use(params);

	return (
		<Suspense fallback={<DiaryStudioClient date={date} />}>
			<DiaryStudioClient date={date} />
		</Suspense>
	);
}
