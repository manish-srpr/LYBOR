export type Lang = "en" | "hi";

export const LANGS: Lang[] = ["en", "hi"];
export const LANG_COOKIE = "striver_lang";

/**
 * A flat dictionary keyed by dotted paths. Flat beats nested here: every key is
 * greppable, and a missing translation degrades to the English string rather
 * than crashing a screen a worker depends on.
 */
const en = {
  "app.name": "STRIVER",
  "app.tagline": "Verified work. Transparent wages.",
  "app.language": "Language",

  "nav.dashboard": "Dashboard",
  "nav.jobs": "Find work",
  "nav.allJobs": "Jobs",
  "nav.applications": "My applications",
  "nav.assignments": "My work",
  "nav.attendance": "Attendance",
  "nav.earnings": "Earnings",
  "nav.history": "Work history",
  "nav.profile": "Profile",
  "nav.kyc": "Identity",
  "nav.disputes": "Disputes",
  "nav.postJob": "Post a job",
  "nav.myJobs": "My jobs",
  "nav.workers": "Workers",
  "nav.approvals": "Approvals",
  "nav.payments": "Payments",
  "nav.fraud": "Risk alerts",
  "nav.users": "Users",
  "nav.overview": "Overview",
  "nav.logout": "Sign out",
  "nav.notifications": "Notifications",

  "auth.login": "Sign in",
  "auth.register": "Create account",
  "auth.phone": "Phone number",
  "auth.password": "Password",
  "auth.fullName": "Full name",
  "auth.role": "I am a",
  "auth.roleWorker": "Worker",
  "auth.roleEmployer": "Employer",
  "auth.noAccount": "New to STRIVER?",
  "auth.haveAccount": "Already registered?",
  "auth.invalid": "Phone number or password is incorrect.",
  "auth.city": "City",
  "auth.demoAccounts": "Demo accounts",

  "common.apply": "Apply",
  "common.applied": "Applied",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.submit": "Submit",
  "common.back": "Back",
  "common.viewDetails": "View details",
  "common.status": "Status",
  "common.date": "Date",
  "common.amount": "Amount",
  "common.none": "Nothing here yet.",
  "common.approve": "Approve",
  "common.reject": "Reject",
  "common.pending": "Pending",
  "common.approved": "Approved",
  "common.rejected": "Rejected",
  "common.paid": "Paid",
  "common.open": "Open",
  "common.resolved": "Resolved",
  "common.km": "km away",
  "common.perHour": "per hour",
  "common.perDay": "per day",
  "common.perShift": "per shift",
  "common.why": "Why this score?",
  "common.loading": "Loading",

  "job.title": "Job",
  "job.employer": "Employer",
  "job.wage": "Wage",
  "job.location": "Location",
  "job.dates": "Dates",
  "job.shift": "Shift",
  "job.skills": "Skills needed",
  "job.openings": "Openings",
  "job.match": "Match",
  "job.applyNow": "Apply for this job",
  "job.applicants": "Applicants",
  "job.assign": "Assign worker",
  "job.assigned": "Assigned",
  "job.description": "About this work",

  "att.checkIn": "Check in",
  "att.checkOut": "Check out",
  "att.checkedInAt": "Checked in at",
  "att.checkedOutAt": "Checked out at",
  "att.verifiedHours": "Verified hours",
  "att.gpsVerified": "GPS verified",
  "att.outsideSite": "Outside job site",
  "att.riskFlags": "Risk checks",
  "att.today": "Today",
  "att.useMyLocation": "Use my location",
  "att.simulate": "Simulate location",

  "wage.breakdown": "Wage breakdown",
  "wage.gross": "Gross",
  "wage.deductions": "Deductions",
  "wage.net": "Net payable",
  "wage.rate": "Rate applied",
  "wage.units": "Billable units",

  "pay.status": "Payment status",
  "pay.markPaid": "Mark as paid",
  "pay.ledger": "Ledger",
  "pay.totalEarned": "Total earned",
  "pay.awaiting": "Awaiting approval",
  "pay.readyToPay": "Approved, awaiting payment",

  "kyc.title": "Identity verification",
  "kyc.submit": "Submit document",
  "kyc.docType": "Document type",
  "kyc.docNumber": "Document number",
  "kyc.holderName": "Name on document",
  "kyc.verified": "Identity verified",
  "kyc.notSubmitted": "Not submitted",

  "dispute.raise": "Raise a dispute",
  "dispute.category": "What is the issue about?",
  "dispute.reason": "Short reason",
  "dispute.description": "What happened?",
  "dispute.resolution": "Resolution",

  "history.verified": "Verified work history",
  "history.daysWorked": "Days worked",
  "history.rating": "Rating",
} as const;

export type TranslationKey = keyof typeof en;

const hi: Record<TranslationKey, string> = {
  "app.name": "स्ट्राइवर",
  "app.tagline": "सत्यापित काम। पारदर्शी मजदूरी।",
  "app.language": "भाषा",

  "nav.dashboard": "डैशबोर्ड",
  "nav.jobs": "काम खोजें",
  "nav.allJobs": "सभी काम",
  "nav.applications": "मेरे आवेदन",
  "nav.assignments": "मेरा काम",
  "nav.attendance": "उपस्थिति",
  "nav.earnings": "कमाई",
  "nav.history": "कार्य इतिहास",
  "nav.profile": "प्रोफ़ाइल",
  "nav.kyc": "पहचान",
  "nav.disputes": "शिकायतें",
  "nav.postJob": "काम पोस्ट करें",
  "nav.myJobs": "मेरे काम",
  "nav.workers": "श्रमिक",
  "nav.approvals": "स्वीकृतियाँ",
  "nav.payments": "भुगतान",
  "nav.fraud": "जोखिम अलर्ट",
  "nav.users": "उपयोगकर्ता",
  "nav.overview": "अवलोकन",
  "nav.logout": "साइन आउट",
  "nav.notifications": "सूचनाएँ",

  "auth.login": "साइन इन करें",
  "auth.register": "खाता बनाएँ",
  "auth.phone": "मोबाइल नंबर",
  "auth.password": "पासवर्ड",
  "auth.fullName": "पूरा नाम",
  "auth.role": "मैं हूँ",
  "auth.roleWorker": "श्रमिक",
  "auth.roleEmployer": "नियोक्ता",
  "auth.noAccount": "स्ट्राइवर पर नए हैं?",
  "auth.haveAccount": "पहले से पंजीकृत हैं?",
  "auth.invalid": "मोबाइल नंबर या पासवर्ड गलत है।",
  "auth.city": "शहर",
  "auth.demoAccounts": "डेमो खाते",

  "common.apply": "आवेदन करें",
  "common.applied": "आवेदन किया",
  "common.save": "सहेजें",
  "common.cancel": "रद्द करें",
  "common.submit": "जमा करें",
  "common.back": "वापस",
  "common.viewDetails": "विवरण देखें",
  "common.status": "स्थिति",
  "common.date": "तारीख",
  "common.amount": "राशि",
  "common.none": "अभी कुछ नहीं है।",
  "common.approve": "स्वीकृत करें",
  "common.reject": "अस्वीकार करें",
  "common.pending": "लंबित",
  "common.approved": "स्वीकृत",
  "common.rejected": "अस्वीकृत",
  "common.paid": "भुगतान हो गया",
  "common.open": "खुला",
  "common.resolved": "हल हो गया",
  "common.km": "किमी दूर",
  "common.perHour": "प्रति घंटा",
  "common.perDay": "प्रति दिन",
  "common.perShift": "प्रति शिफ्ट",
  "common.why": "यह स्कोर क्यों?",
  "common.loading": "लोड हो रहा है",

  "job.title": "काम",
  "job.employer": "नियोक्ता",
  "job.wage": "मजदूरी",
  "job.location": "स्थान",
  "job.dates": "तारीखें",
  "job.shift": "शिफ्ट",
  "job.skills": "आवश्यक कौशल",
  "job.openings": "रिक्तियाँ",
  "job.match": "मिलान",
  "job.applyNow": "इस काम के लिए आवेदन करें",
  "job.applicants": "आवेदक",
  "job.assign": "श्रमिक नियुक्त करें",
  "job.assigned": "नियुक्त",
  "job.description": "काम के बारे में",

  "att.checkIn": "चेक इन",
  "att.checkOut": "चेक आउट",
  "att.checkedInAt": "चेक इन समय",
  "att.checkedOutAt": "चेक आउट समय",
  "att.verifiedHours": "सत्यापित घंटे",
  "att.gpsVerified": "जीपीएस सत्यापित",
  "att.outsideSite": "कार्यस्थल के बाहर",
  "att.riskFlags": "जोखिम जाँच",
  "att.today": "आज",
  "att.useMyLocation": "मेरा स्थान उपयोग करें",
  "att.simulate": "स्थान सिमुलेट करें",

  "wage.breakdown": "मजदूरी विवरण",
  "wage.gross": "कुल",
  "wage.deductions": "कटौती",
  "wage.net": "देय राशि",
  "wage.rate": "लागू दर",
  "wage.units": "बिल योग्य इकाइयाँ",

  "pay.status": "भुगतान स्थिति",
  "pay.markPaid": "भुगतान चिह्नित करें",
  "pay.ledger": "बही",
  "pay.totalEarned": "कुल कमाई",
  "pay.awaiting": "स्वीकृति की प्रतीक्षा",
  "pay.readyToPay": "स्वीकृत, भुगतान बाकी",

  "kyc.title": "पहचान सत्यापन",
  "kyc.submit": "दस्तावेज़ जमा करें",
  "kyc.docType": "दस्तावेज़ प्रकार",
  "kyc.docNumber": "दस्तावेज़ संख्या",
  "kyc.holderName": "दस्तावेज़ पर नाम",
  "kyc.verified": "पहचान सत्यापित",
  "kyc.notSubmitted": "जमा नहीं किया",

  "dispute.raise": "शिकायत दर्ज करें",
  "dispute.category": "मामला किस बारे में है?",
  "dispute.reason": "संक्षिप्त कारण",
  "dispute.description": "क्या हुआ?",
  "dispute.resolution": "समाधान",

  "history.verified": "सत्यापित कार्य इतिहास",
  "history.daysWorked": "काम के दिन",
  "history.rating": "रेटिंग",
};

const DICTIONARIES: Record<Lang, Record<TranslationKey, string>> = {
  en,
  hi,
};

export function translate(lang: Lang, key: TranslationKey): string {
  return DICTIONARIES[lang][key] ?? en[key] ?? key;
}

export type Translator = (key: TranslationKey) => string;

export function translatorFor(lang: Lang): Translator {
  return (key) => translate(lang, key);
}

/** Picks the right side of an en/hi string pair produced by the domain engines. */
export function pick(lang: Lang, enText: string, hiText: string): string {
  return lang === "hi" ? hiText : enText;
}

export function normaliseLang(value: string | undefined | null): Lang {
  return value === "hi" ? "hi" : "en";
}
