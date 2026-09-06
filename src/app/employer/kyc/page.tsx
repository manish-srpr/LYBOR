import { KycPanel } from "@/components/app/kyc-panel";
import { requireEmployerProfile } from "@/lib/auth";
import { getLang } from "@/lib/lang";

export default async function EmployerKycPage() {
  const { session, profile } = await requireEmployerProfile();
  const lang = await getLang();

  return (
    <KycPanel
      userId={session.userId}
      fullName={profile.contactPerson}
      kycStatus={profile.kycStatus}
      lang={lang}
    />
  );
}
