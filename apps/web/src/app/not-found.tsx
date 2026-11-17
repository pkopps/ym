import { PageErrorState } from "../components/PageErrorState";

export default function NotFound() {
  return <PageErrorState titleKey="not_found.title" bodyKey="not_found.body" />;
}
