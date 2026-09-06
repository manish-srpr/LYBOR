-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "travelRadiusKm" REAL NOT NULL DEFAULT 15,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "availableFrom" DATETIME,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "preferredWageType" TEXT,
    "preferredWageMinPaise" INTEGER,
    "kycStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "reliabilityScore" REAL NOT NULL DEFAULT 0,
    "reliabilityUpdatedAt" DATETIME,
    "totalJobsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalMinutesWorked" INTEGER NOT NULL DEFAULT 0,
    "totalEarningsPaise" INTEGER NOT NULL DEFAULT 0,
    "averageRating" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyType" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "about" TEXT,
    "logoUrl" TEXT,
    "gstNumber" TEXT,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "kycStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "totalJobsPosted" INTEGER NOT NULL DEFAULT 0,
    "totalWorkersHired" INTEGER NOT NULL DEFAULT 0,
    "totalPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "averageRating" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT
);

-- CreateTable
CREATE TABLE "WorkerSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerProfileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" TEXT NOT NULL DEFAULT 'INTERMEDIATE',
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerSkill_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employerProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "checkInRadiusMeters" INTEGER NOT NULL DEFAULT 250,
    "wageType" TEXT NOT NULL,
    "wageRatePaise" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "expectedHoursPerDay" REAL NOT NULL DEFAULT 8,
    "workersRequired" INTEGER NOT NULL DEFAULT 1,
    "workersAssigned" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "EmployerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "JobSkill_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "coverNote" TEXT,
    "matchScore" REAL,
    "matchFactors" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobApplication_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "agreedWageType" TEXT NOT NULL,
    "agreedWageRatePaise" INTEGER NOT NULL,
    "expectedHoursPerDay" REAL NOT NULL DEFAULT 8,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobAssignment_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "checkInTime" DATETIME NOT NULL,
    "checkInLatitude" REAL NOT NULL,
    "checkInLongitude" REAL NOT NULL,
    "checkInAccuracyM" REAL,
    "checkInDistanceM" REAL NOT NULL,
    "checkInWithinRadius" BOOLEAN NOT NULL,
    "checkInSource" TEXT NOT NULL DEFAULT 'GPS',
    "checkOutTime" DATETIME,
    "checkOutLatitude" REAL,
    "checkOutLongitude" REAL,
    "checkOutAccuracyM" REAL,
    "checkOutDistanceM" REAL,
    "checkOutWithinRadius" BOOLEAN,
    "checkOutSource" TEXT,
    "workingMinutes" INTEGER,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "riskScore" REAL NOT NULL DEFAULT 0,
    "riskFlags" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedByUserId" TEXT,
    "rejectionReason" TEXT,
    "workerNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attendance_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JobAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "wageType" TEXT NOT NULL,
    "rateAppliedPaise" INTEGER NOT NULL,
    "verifiedMinutes" INTEGER NOT NULL,
    "billableUnits" REAL NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "grossAmountPaise" INTEGER NOT NULL,
    "deductionsPaise" INTEGER NOT NULL DEFAULT 0,
    "netAmountPaise" INTEGER NOT NULL,
    "calculationBreakdown" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JobAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "fromParty" TEXT NOT NULL,
    "toParty" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MOCK_LEDGER',
    "providerRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "assignmentId" TEXT,
    "attendanceId" TEXT,
    "paymentId" TEXT,
    "raisedByUserId" TEXT NOT NULL,
    "raisedByRole" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminResolution" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dispute_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JobAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dispute_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dispute_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KYCRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "docNumberMasked" TEXT NOT NULL,
    "docNumberHash" TEXT NOT NULL,
    "documentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    CONSTRAINT "KYCRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KYCRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerProfileId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "employerProfileId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "skillsUsed" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalVerifiedMinutes" INTEGER NOT NULL,
    "totalDaysWorked" INTEGER NOT NULL,
    "totalEarningsPaise" INTEGER NOT NULL,
    "employerRating" INTEGER,
    "employerReview" TEXT,
    "workerRating" INTEGER,
    "completionStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkHistory_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkHistory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JobAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkHistory_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "EmployerProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "params" TEXT,
    "linkUrl" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'DELIVERED',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "workerProfileId" TEXT,
    "employerProfileId" TEXT,
    "attendanceId" TEXT,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FraudAlert_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FraudAlert_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "EmployerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FraudAlert_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FraudAlert_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FraudAlert_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_userId_key" ON "WorkerProfile"("userId");

-- CreateIndex
CREATE INDEX "WorkerProfile_city_idx" ON "WorkerProfile"("city");

-- CreateIndex
CREATE INDEX "WorkerProfile_availability_idx" ON "WorkerProfile"("availability");

-- CreateIndex
CREATE INDEX "WorkerProfile_kycStatus_idx" ON "WorkerProfile"("kycStatus");

-- CreateIndex
CREATE INDEX "WorkerProfile_reliabilityScore_idx" ON "WorkerProfile"("reliabilityScore");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerProfile_userId_key" ON "EmployerProfile"("userId");

-- CreateIndex
CREATE INDEX "EmployerProfile_city_idx" ON "EmployerProfile"("city");

-- CreateIndex
CREATE INDEX "EmployerProfile_kycStatus_idx" ON "EmployerProfile"("kycStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- CreateIndex
CREATE INDEX "Skill_category_idx" ON "Skill"("category");

-- CreateIndex
CREATE INDEX "WorkerSkill_skillId_idx" ON "WorkerSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerSkill_workerProfileId_skillId_key" ON "WorkerSkill"("workerProfileId", "skillId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_category_idx" ON "Job"("category");

-- CreateIndex
CREATE INDEX "Job_city_idx" ON "Job"("city");

-- CreateIndex
CREATE INDEX "Job_employerProfileId_idx" ON "Job"("employerProfileId");

-- CreateIndex
CREATE INDEX "Job_startDate_idx" ON "Job"("startDate");

-- CreateIndex
CREATE INDEX "JobSkill_skillId_idx" ON "JobSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "JobSkill_jobId_skillId_key" ON "JobSkill"("jobId", "skillId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE INDEX "JobApplication_workerProfileId_idx" ON "JobApplication"("workerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_workerProfileId_key" ON "JobApplication"("jobId", "workerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "JobAssignment_applicationId_key" ON "JobAssignment"("applicationId");

-- CreateIndex
CREATE INDEX "JobAssignment_status_idx" ON "JobAssignment"("status");

-- CreateIndex
CREATE INDEX "JobAssignment_workerProfileId_idx" ON "JobAssignment"("workerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "JobAssignment_jobId_workerProfileId_key" ON "JobAssignment"("jobId", "workerProfileId");

-- CreateIndex
CREATE INDEX "Attendance_verificationStatus_idx" ON "Attendance"("verificationStatus");

-- CreateIndex
CREATE INDEX "Attendance_approvalStatus_idx" ON "Attendance"("approvalStatus");

-- CreateIndex
CREATE INDEX "Attendance_workDate_idx" ON "Attendance"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_assignmentId_workDate_key" ON "Attendance"("assignmentId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_attendanceId_key" ON "Payment"("attendanceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_assignmentId_idx" ON "Payment"("assignmentId");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_paymentId_idx" ON "PaymentLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_entryType_idx" ON "PaymentLedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_raisedByUserId_idx" ON "Dispute"("raisedByUserId");

-- CreateIndex
CREATE INDEX "Dispute_category_idx" ON "Dispute"("category");

-- CreateIndex
CREATE INDEX "KYCRecord_status_idx" ON "KYCRecord"("status");

-- CreateIndex
CREATE INDEX "KYCRecord_userId_idx" ON "KYCRecord"("userId");

-- CreateIndex
CREATE INDEX "KYCRecord_docNumberHash_idx" ON "KYCRecord"("docNumberHash");

-- CreateIndex
CREATE UNIQUE INDEX "WorkHistory_assignmentId_key" ON "WorkHistory"("assignmentId");

-- CreateIndex
CREATE INDEX "WorkHistory_workerProfileId_idx" ON "WorkHistory"("workerProfileId");

-- CreateIndex
CREATE INDEX "WorkHistory_employerProfileId_idx" ON "WorkHistory"("employerProfileId");

-- CreateIndex
CREATE INDEX "WorkHistory_category_idx" ON "WorkHistory"("category");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "FraudAlert_status_idx" ON "FraudAlert"("status");

-- CreateIndex
CREATE INDEX "FraudAlert_severity_idx" ON "FraudAlert"("severity");

-- CreateIndex
CREATE INDEX "FraudAlert_ruleCode_idx" ON "FraudAlert"("ruleCode");
