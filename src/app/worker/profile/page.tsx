import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { ProfileForm } from "./profile-form";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatMinutes, formatPaise } from "@/lib/money";
import { normaliseLang } from "@/lib/i18n";

export default async function WorkerProfilePage() {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const [skills, workerSkills] = await Promise.all([
    prisma.skill.findMany({ orderBy: [{ category: "asc" }, { nameEn: "asc" }] }),
    prisma.workerSkill.findMany({
      where: { workerProfileId: profile.id },
      select: { skillId: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.profile")}
        description={
          isHi
            ? "यह जानकारी सीधे तय करती है कि आपको कौन-सा काम दिखेगा।"
            : "This information directly decides which jobs you are shown."
        }
        action={<StatusBadge status={profile.kycStatus} lang={lang} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>{profile.user.fullName}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--border)]">
          <DataRow label={t("auth.phone")} value={profile.user.phone} />
          <DataRow label={t("auth.city")} value={`${profile.city}, ${profile.state}`} />
          <DataRow
            label={isHi ? "पूरे किए गए काम" : "Jobs completed"}
            value={String(profile.totalJobsCompleted)}
          />
          <DataRow
            label={t("att.verifiedHours")}
            value={formatMinutes(profile.totalMinutesWorked)}
          />
          <DataRow
            label={t("pay.totalEarned")}
            value={formatPaise(profile.totalEarningsPaise)}
          />
          <DataRow
            label={isHi ? "विश्वसनीयता" : "Reliability"}
            value={`${Math.round(profile.reliabilityScore)}/100`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isHi ? "प्रोफ़ाइल संपादित करें" : "Edit your profile"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            lang={lang}
            skills={skills.map((skill) => ({
              id: skill.id,
              nameEn: skill.nameEn,
              nameHi: skill.nameHi,
              category: skill.category,
            }))}
            selectedSkillIds={workerSkills.map((s) => s.skillId)}
            profile={{
              bio: profile.bio,
              experienceYears: profile.experienceYears,
              travelRadiusKm: profile.travelRadiusKm,
              availability: profile.availability,
              preferredWageType: profile.preferredWageType,
              preferredWageMinPaise: profile.preferredWageMinPaise,
              language: normaliseLang(profile.user.preferredLanguage),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
