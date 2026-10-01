import { Suspense } from "react";
import { BookingConfirmationPage } from "../../../../components/BookingConfirmationPage";
import { noIndexRobots } from "../../../../lib/site";
export const metadata = { robots: noIndexRobots };
export default function Page() { return <Suspense><BookingConfirmationPage /></Suspense>; }
