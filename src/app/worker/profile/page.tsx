import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { SkillTrustPanel } from "@/components/app/skill-trust-panel";
import { ProfileForm } from "./profile-form";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { getWorkerTrust } from "@/lib/skill-evidence";
import { formatMinutes, formatPaise } from "@/lib/money";
import { normaliseLang } from "@/lib/i18n";

export default async function WorkerProfilePage() {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const [skills, workerSkills, trust] = await Promise.all([
    prisma.skill.findMany({ orderBy: [{ category: "asc" }, { nameEn: "asc" }] }),
    prisma.workerSkill.findMany({
      where: { workerProfileId: profile.id },
      select: { skillId: true, proficiency: true },
    }),
    getWorkerTrust(profile.id),
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

      {/*
        Shown to the worker in the same shape the employer sees, deliberately.
        Somebody whose claim is unverified should find that out on their own
        profile, with the next step next to it, rather than being turned down
        for jobs and never learning why.
      */}
      <SkillTrustPanel skills={trust.skills} lang={lang} showNextSteps />

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
            skillLevels={Object.fromEntries(
              workerSkills.map((s) => [s.skillId, s.proficiency]),
            )}
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
