import { PageHeader } from "@/components/ui/misc";
import { JobForm } from "./job-form";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

export default async function NewJobPage() {
  const { profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const skills = await prisma.skill.findMany({
    orderBy: [{ category: "asc" }, { nameEn: "asc" }],
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.postJob")}
        description={
          lang === "hi"
            ? "स्पष्ट मजदूरी और कार्यस्थल बताएँ। दोनों बाद में जमे रहते हैं।"
            : "State the wage and site precisely. Both are frozen onto every assignment."
        }
      />
      <JobForm
        lang={lang}
        skills={skills.map((skill) => ({
          id: skill.id,
          nameEn: skill.nameEn,
          nameHi: skill.nameHi,
        }))}
        employerSite={{
          addressLine: profile.addressLine,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          latitude: profile.latitude,
          longitude: profile.longitude,
        }}
      />
    </div>
  );
}
