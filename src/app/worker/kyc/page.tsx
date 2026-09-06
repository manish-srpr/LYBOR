import { KycPanel } from "@/components/app/kyc-panel";
import { requireWorkerProfile } from "@/lib/auth";
import { getLang } from "@/lib/lang";

export default async function WorkerKycPage() {
  const { session, profile } = await requireWorkerProfile();
  const lang = await getLang();

  return (
    <KycPanel
      userId={session.userId}
      fullName={profile.user.fullName}
      kycStatus={profile.kycStatus}
      lang={lang}
    />
  );
}
