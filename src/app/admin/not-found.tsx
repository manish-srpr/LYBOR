import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

/**
 * Rendered inside the role shell, so a dead link still leaves the user with
 * their navigation rather than a bare page.
 */
export default function NotFound() {
  return (
    <EmptyState
      title="This page is no longer available"
      description="The job, assignment or record you followed may have been closed or removed."
      action={
        <Link href="/admin" className={buttonVariants({ size: "sm" })}>
          <Compass aria-hidden />
          Back to your dashboard
        </Link>
      }
    />
  );
}
