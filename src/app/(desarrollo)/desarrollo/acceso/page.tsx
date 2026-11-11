import { notFound } from "next/navigation";
import DevAccess from "./DevAccess";

export const dynamic = "force-dynamic";

export default function DevAccessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DevAccess />;
}
