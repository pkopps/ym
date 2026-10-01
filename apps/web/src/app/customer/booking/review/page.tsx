import { Suspense } from "react";
import { BookingReviewPage } from "../../../../components/BookingReviewPage";
import { noIndexRobots } from "../../../../lib/site";
export const metadata = { robots: noIndexRobots };
export default function Page() { return <Suspense><BookingReviewPage /></Suspense>; }
