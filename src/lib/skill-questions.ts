/**
 * The skill check: five practical questions per trade.
 *
 * Scope is deliberate. Five multiple-choice questions cannot certify a
 * tradesperson, and nothing in the UI says they can - the level they unlock is
 * "Skilled", which means "showed basic knowledge", and Verified and Expert both
 * additionally require finished work that employers rated. The check exists to
 * put *something* between a typed claim and a badge, not to replace a trade
 * test.
 *
 * Questions favour safety and judgement over recall, because those are what a
 * wrong answer costs on a site, and they are answerable by someone who has
 * done the work without formal schooling. Each carries its own explanation, so
 * a worker who gets one wrong learns the answer rather than just losing a mark.
 *
 * Only trades where a short check is meaningful are covered. A skill with no
 * bank simply has no check available, and its workers stay Self-declared -
 * which is honest, and better than inventing questions to fill a table.
 */

export const QUESTION_BANK_VERSION = 1;

/** How many are asked. The whole bank, for now; kept explicit for the UI. */
export const QUESTIONS_PER_CHECK = 5;

export type SkillQuestion = {
  id: string;
  /** English and Hindi only. Other locales fall back, as elsewhere. */
  prompt: string;
  promptHi: string;
  options: string[];
  optionsHi: string[];
  /** Index into `options`. */
  answer: number;
  /** Shown after answering, right or wrong. */
  why: string;
  whyHi: string;
};

const BANK: Record<string, SkillQuestion[]> = {
  ELECTRICAL: [
    {
      id: "el1",
      prompt: "Before working on a circuit, what must you do first?",
      promptHi: "किसी सर्किट पर काम शुरू करने से पहले सबसे पहले क्या करना चाहिए?",
      options: [
        "Switch off the MCB and confirm the line is dead with a tester",
        "Wear gloves and start work",
        "Ask a colleague to hold the wire",
        "Work quickly so there is less risk",
      ],
      optionsHi: [
        "एमसीबी बंद करें और टेस्टर से जाँचें कि लाइन में करंट नहीं है",
        "दस्ताने पहनकर काम शुरू करें",
        "किसी साथी से तार पकड़वाएँ",
        "जल्दी काम करें ताकि जोखिम कम हो",
      ],
      answer: 0,
      why: "Isolate, then prove dead with a tester. Assuming a switch is off has killed people; testing takes seconds.",
      whyHi: "पहले बिजली काटें, फिर टेस्टर से पुष्टि करें। स्विच बंद मान लेना जानलेवा हो सकता है।",
    },
    {
      id: "el2",
      prompt: "An MCB trips every time a particular appliance is switched on. The most likely cause is:",
      promptHi: "एक विशेष उपकरण चालू करते ही एमसीबी ट्रिप हो जाता है। सबसे संभावित कारण:",
      options: [
        "A short circuit or earth fault in that appliance or its circuit",
        "The MCB is too strong",
        "The wire is too thick",
        "There is no neutral in the building",
      ],
      optionsHi: [
        "उस उपकरण या उसके सर्किट में शॉर्ट सर्किट या अर्थ फॉल्ट",
        "एमसीबी बहुत मजबूत है",
        "तार बहुत मोटा है",
        "इमारत में न्यूट्रल नहीं है",
      ],
      answer: 0,
      why: "A breaker that trips on a specific load is doing its job - it is reporting a fault in that load or its wiring.",
      whyHi: "किसी एक उपकरण पर ट्रिप होना बताता है कि उस उपकरण या उसकी वायरिंग में खराबी है।",
    },
    {
      id: "el3",
      prompt: "In standard Indian wiring, the earth wire is usually:",
      promptHi: "भारतीय वायरिंग में अर्थ का तार आमतौर पर होता है:",
      options: ["Green or green-yellow", "Red", "Black", "Blue"],
      optionsHi: ["हरा या हरा-पीला", "लाल", "काला", "नीला"],
      answer: 0,
      why: "Green, or green with a yellow stripe, is earth. Getting this wrong makes an appliance body live.",
      whyHi: "हरा या हरा-पीला अर्थ होता है। गलती होने पर उपकरण की बॉडी में करंट आ सकता है।",
    },
    {
      id: "el4",
      prompt: "A socket feels warm and smells burnt. You should:",
      promptHi: "एक सॉकेट गरम है और जलने की गंध आ रही है। आपको चाहिए:",
      options: [
        "Isolate the circuit, then inspect for loose or burnt connections",
        "Spray water on it to cool it",
        "Put tape over it and carry on",
        "Increase the MCB rating",
      ],
      optionsHi: [
        "सर्किट की बिजली काटें, फिर ढीले या जले कनेक्शन जाँचें",
        "ठंडा करने के लिए पानी डालें",
        "टेप लगाकर काम जारी रखें",
        "एमसीबी की रेटिंग बढ़ा दें",
      ],
      answer: 0,
      why: "Heat and burning smell mean a loose or overloaded connection. Raising the MCB rating removes the protection instead of the fault.",
      whyHi: "गर्मी और जलने की गंध ढीले या ओवरलोड कनेक्शन का संकेत है। एमसीबी बढ़ाना सुरक्षा हटा देता है।",
    },
    {
      id: "el5",
      prompt: "What is a test lamp or multimeter mainly used for on site?",
      promptHi: "साइट पर टेस्ट लैंप या मल्टीमीटर मुख्यतः किसलिए उपयोग होता है?",
      options: [
        "Confirming whether a conductor is live before touching it",
        "Tightening screws",
        "Measuring pipe length",
        "Cutting cable",
      ],
      optionsHi: [
        "छूने से पहले यह जाँचने के लिए कि तार में करंट है या नहीं",
        "पेंच कसने के लिए",
        "पाइप की लंबाई मापने के लिए",
        "केबल काटने के लिए",
      ],
      answer: 0,
      why: "It is how you prove a circuit dead. It is the difference between believing it is safe and knowing.",
      whyHi: "यही सिद्ध करता है कि सर्किट में करंट नहीं है — अनुमान और पुष्टि में यही अंतर है।",
    },
  ],

  PLUMBING: [
    {
      id: "pl1",
      prompt: "A joint drips slowly after tightening. The usual first step is:",
      promptHi: "कसने के बाद भी जोड़ से धीरे-धीरे पानी टपक रहा है। पहला कदम:",
      options: [
        "Shut the supply, undo the joint and redo it with fresh sealing tape or paste",
        "Tighten much harder until it stops",
        "Paint over the joint",
        "Leave it - a slow drip is normal",
      ],
      optionsHi: [
        "सप्लाई बंद करें, जोड़ खोलें और नई टेप या पेस्ट लगाकर दोबारा जोड़ें",
        "बहुत ज़ोर से कसें जब तक रुक जाए",
        "जोड़ पर पेंट कर दें",
        "छोड़ दें — धीमा टपकना सामान्य है",
      ],
      answer: 0,
      why: "Overtightening cracks fittings and turns a drip into a burst. Remake the joint properly.",
      whyHi: "ज़्यादा कसने से फिटिंग चटक सकती है और रिसाव फूट सकता है। जोड़ ठीक से दोबारा बनाएँ।",
    },
    {
      id: "pl2",
      prompt: "Before cutting into any water line you must:",
      promptHi: "किसी भी पानी की लाइन काटने से पहले आपको चाहिए:",
      options: [
        "Close the stop valve and drain the section",
        "Cut quickly and fit fast",
        "Cover the floor and cut",
        "Turn on all taps and cut",
      ],
      optionsHi: [
        "स्टॉप वाल्व बंद करें और उस हिस्से का पानी निकाल दें",
        "जल्दी काटें और तेज़ी से फिट करें",
        "फर्श ढककर काट दें",
        "सभी नल खोलकर काटें",
      ],
      answer: 0,
      why: "Isolate and drain first. Cutting a charged line floods the work area and can damage the building.",
      whyHi: "पहले वाल्व बंद करें और पानी निकालें। भरी लाइन काटने से पानी भर जाता है।",
    },
    {
      id: "pl3",
      prompt: "Very low flow at one upper-floor tap while others are fine suggests:",
      promptHi: "ऊपरी मंज़िल के एक नल में बहाव बहुत कम है, बाकी ठीक हैं। यह संकेत देता है:",
      options: [
        "A blocked aerator or a partly closed valve on that branch",
        "The whole building has no water",
        "The pipe is too short",
        "The tap is the wrong colour",
      ],
      optionsHi: [
        "उस नल का एरेटर जाम है या उस शाखा का वाल्व आधा बंद है",
        "पूरी इमारत में पानी नहीं है",
        "पाइप बहुत छोटा है",
        "नल का रंग गलत है",
      ],
      answer: 0,
      why: "One outlet affected points at that outlet or its branch, not the main supply. Check the cheapest, nearest cause first.",
      whyHi: "एक ही नल प्रभावित हो तो समस्या उसी नल या शाखा में है, मुख्य सप्लाई में नहीं।",
    },
    {
      id: "pl4",
      prompt: "PTFE (white) tape is wrapped:",
      promptHi: "पीटीएफई (सफेद) टेप लपेटी जाती है:",
      options: [
        "In the direction that keeps it from unwinding as the joint is tightened",
        "Loosely, one turn only",
        "Over the outside of the fitting",
        "Only on plastic pipes",
      ],
      optionsHi: [
        "उस दिशा में जिससे जोड़ कसते समय टेप न खुले",
        "ढीला, केवल एक लपेट",
        "फिटिंग के बाहर की ओर",
        "केवल प्लास्टिक पाइप पर",
      ],
      answer: 0,
      why: "Wrapped against the tightening direction it unwinds and the seal fails. Direction matters more than quantity.",
      whyHi: "गलत दिशा में लपेटी टेप कसते समय खुल जाती है और सील फेल हो जाती है।",
    },
    {
      id: "pl5",
      prompt: "After finishing a repair, the correct check is:",
      promptHi: "मरम्मत पूरी करने के बाद सही जाँच है:",
      options: [
        "Restore supply slowly and watch every joint under pressure",
        "Pack up immediately",
        "Only check the following day",
        "Ask the customer to check",
      ],
      optionsHi: [
        "धीरे-धीरे सप्लाई चालू करें और दबाव में हर जोड़ देखें",
        "तुरंत सामान समेट लें",
        "अगले दिन ही जाँचें",
        "ग्राहक से जाँच करवाएँ",
      ],
      answer: 0,
      why: "Most failures show in the first minutes under pressure, while you are still there to fix them.",
      whyHi: "ज़्यादातर खराबी दबाव आने के पहले कुछ मिनटों में दिखती है, जब आप वहीं मौजूद होते हैं।",
    },
  ],

  CARPENTRY: [
    {
      id: "ca1",
      prompt: "The saying \"measure twice, cut once\" matters because:",
      promptHi: "“दो बार नापो, एक बार काटो” क्यों महत्वपूर्ण है?",
      options: [
        "A cut cannot be undone, and wasted material costs money and time",
        "Saws blunt quickly",
        "It looks professional",
        "Wood expands when measured",
      ],
      optionsHi: [
        "कटा हुआ जोड़ा नहीं जा सकता, और बर्बाद सामान समय व पैसा दोनों खाता है",
        "आरी जल्दी घिस जाती है",
        "यह पेशेवर दिखता है",
        "नापने पर लकड़ी फैल जाती है",
      ],
      answer: 0,
      why: "Material is the expensive part. Checking a measurement is free.",
      whyHi: "सामान महँगा है, नाप दोबारा जाँचना मुफ़्त।",
    },
    {
      id: "ca2",
      prompt: "For a right-angled corner joint in a door frame, you would use:",
      promptHi: "दरवाज़े के फ्रेम के समकोण कोने के लिए आप उपयोग करेंगे:",
      options: ["A mortise and tenon or a halving joint", "Only nails", "Only adhesive tape", "A butt joint with one screw"],
      optionsHi: ["मोर्टिस-टेनन या हाफ लैप जोड़", "केवल कीलें", "केवल चिपकने वाली टेप", "एक पेंच वाला बट जोड़"],
      answer: 0,
      why: "Interlocking joints carry load and resist racking; nails alone loosen as the frame is used.",
      whyHi: "आपस में फँसने वाले जोड़ भार सहते हैं; केवल कीलें समय के साथ ढीली हो जाती हैं।",
    },
    {
      id: "ca3",
      prompt: "Timber that has not dried properly will most likely:",
      promptHi: "ठीक से न सूखी लकड़ी सबसे अधिक संभावना से:",
      options: ["Warp, shrink or split after fitting", "Become stronger", "Change colour only", "Weigh less"],
      optionsHi: ["फिट करने के बाद मुड़ेगी, सिकुड़ेगी या फटेगी", "मजबूत हो जाएगी", "केवल रंग बदलेगी", "हल्की हो जाएगी"],
      answer: 0,
      why: "Green timber moves as it dries, which is why a good job can fail weeks later. Check moisture before fitting.",
      whyHi: "गीली लकड़ी सूखते समय हिलती है, इसलिए अच्छा काम भी हफ़्तों बाद खराब हो सकता है।",
    },
    {
      id: "ca4",
      prompt: "When using a circular saw, the safest practice is:",
      promptHi: "गोल आरी चलाते समय सबसे सुरक्षित तरीका है:",
      options: [
        "Clamp the work, keep both hands on the saw, and let the blade reach speed before cutting",
        "Hold the work with one hand and cut with the other",
        "Remove the guard for a better view",
        "Cut towards yourself for control",
      ],
      optionsHi: [
        "काम को क्लैंप करें, दोनों हाथ आरी पर रखें, और ब्लेड पूरी गति पर आने दें",
        "एक हाथ से काम पकड़ें, दूसरे से काटें",
        "अच्छी दृष्टि के लिए गार्ड हटा दें",
        "नियंत्रण के लिए अपनी ओर काटें",
      ],
      answer: 0,
      why: "Most circular-saw injuries come from holding the work by hand or removing the guard. Clamping frees both hands.",
      whyHi: "अधिकांश चोटें काम को हाथ से पकड़ने या गार्ड हटाने से होती हैं। क्लैंप करने से दोनों हाथ खाली रहते हैं।",
    },
    {
      id: "ca5",
      prompt: "A spirit level is used to check that a surface is:",
      promptHi: "स्पिरिट लेवल से जाँचा जाता है कि सतह है:",
      options: ["Level or plumb", "Smooth", "Dry", "The right colour"],
      optionsHi: ["समतल या ऊर्ध्वाधर", "चिकनी", "सूखी", "सही रंग की"],
      answer: 0,
      why: "Level (horizontal) and plumb (vertical). A frame that is neither will bind or swing on its own.",
      whyHi: "समतल (क्षैतिज) और ऊर्ध्वाधर। इनके बिना फ्रेम अटकेगा या खुद खुलेगा।",
    },
  ],

  MASONRY: [
    {
      id: "ma1",
      prompt: "Bricks are usually wetted before laying because:",
      promptHi: "चिनाई से पहले ईंटों को गीला करने का कारण:",
      options: [
        "Dry bricks pull water out of the mortar and weaken the bond",
        "It makes them heavier",
        "It changes their colour",
        "It is only for decoration",
      ],
      optionsHi: [
        "सूखी ईंटें मसाले से पानी खींच लेती हैं और जोड़ कमजोर हो जाता है",
        "इससे वे भारी हो जाती हैं",
        "इससे रंग बदल जाता है",
        "यह केवल सजावट के लिए है",
      ],
      answer: 0,
      why: "Mortar needs its water to cure. A dry brick steals it and the joint never reaches strength.",
      whyHi: "मसाले को जमने के लिए पानी चाहिए। सूखी ईंट वह पानी खींच लेती है और जोड़ मजबूत नहीं होता।",
    },
    {
      id: "ma2",
      prompt: "A plumb bob or spirit level is used in blockwork to ensure the wall is:",
      promptHi: "चिनाई में साहुल या लेवल का उपयोग यह सुनिश्चित करने के लिए होता है कि दीवार:",
      options: ["Vertical", "Warm", "Watertight", "Painted evenly"],
      optionsHi: ["ऊर्ध्वाधर है", "गर्म है", "जलरोधक है", "समान रूप से रंगी है"],
      answer: 0,
      why: "An out-of-plumb wall carries load off-centre and can fail. It is checked as courses go up, not at the end.",
      whyHi: "टेढ़ी दीवार पर भार असमान पड़ता है। इसे परत-दर-परत जाँचा जाता है, अंत में नहीं।",
    },
    {
      id: "ma3",
      prompt: "Vertical joints are staggered between courses so that:",
      promptHi: "परतों के बीच खड़े जोड़ आगे-पीछे रखे जाते हैं ताकि:",
      options: [
        "Load spreads across bricks instead of running down one weak line",
        "The wall looks patterned",
        "Less mortar is needed",
        "The wall dries faster",
      ],
      optionsHi: [
        "भार एक कमजोर रेखा पर न पड़े, बल्कि ईंटों में बँट जाए",
        "दीवार में डिज़ाइन दिखे",
        "मसाला कम लगे",
        "दीवार जल्दी सूखे",
      ],
      answer: 0,
      why: "Aligned joints create a continuous crack path. Staggering is what makes a wall act as one piece.",
      whyHi: "सीधी रेखा में जोड़ दरार का रास्ता बना देते हैं। आगे-पीछे रखने से दीवार एक इकाई बनती है।",
    },
    {
      id: "ma4",
      prompt: "Freshly laid masonry is cured by:",
      promptHi: "ताज़ी चिनाई की तराई की जाती है:",
      options: [
        "Keeping it damp for several days",
        "Drying it in direct sun as fast as possible",
        "Covering it with oil",
        "Adding salt to the mortar",
      ],
      optionsHi: [
        "कई दिनों तक नम रखकर",
        "तेज़ धूप में जल्दी सुखाकर",
        "तेल से ढककर",
        "मसाले में नमक मिलाकर",
      ],
      answer: 0,
      why: "Cement gains strength by hydrating. Drying it fast in the sun gives a weaker wall that looks finished.",
      whyHi: "सीमेंट पानी के साथ प्रतिक्रिया से मजबूत होता है। जल्दी सुखाने से दीवार कमजोर रहती है।",
    },
    {
      id: "ma5",
      prompt: "On a site where material is lifted overhead, the essential precaution is:",
      promptHi: "जहाँ सामान ऊपर उठाया जा रहा है, वहाँ आवश्यक सावधानी:",
      options: [
        "Helmet on, and nobody standing under the load",
        "Work faster to reduce exposure",
        "Stand close to guide the load by hand",
        "Remove the helmet for better hearing",
      ],
      optionsHi: [
        "हेलमेट पहनें, और भार के नीचे कोई न खड़ा हो",
        "जोखिम कम करने के लिए तेज़ काम करें",
        "भार को हाथ से दिशा देने के लिए पास खड़े हों",
        "बेहतर सुनने के लिए हेलमेट हटा दें",
      ],
      answer: 0,
      why: "Dropped loads are among the commonest fatal site accidents, and the exclusion zone is what prevents them.",
      whyHi: "गिरता भार साइट पर होने वाली सबसे घातक दुर्घटनाओं में है; नीचे न खड़ा होना ही बचाव है।",
    },
  ],
};

/** Whether a check exists for a skill. */
export function hasAssessment(skillCode: string): boolean {
  return skillCode in BANK;
}

export function assessmentSkillCodes(): string[] {
  return Object.keys(BANK);
}

/** The questions for a skill, or an empty array if it has no check. */
export function questionsFor(skillCode: string): SkillQuestion[] {
  return BANK[skillCode] ?? [];
}

/**
 * Marks a submission on the server.
 *
 * The answer key never reaches the browser: the questions are sent without
 * `answer`, and grading happens here. Otherwise a worker could read the
 * correct answers out of the page source and the check would prove nothing.
 */
export function gradeAssessment(
  skillCode: string,
  chosen: Record<string, number>,
): { correctCount: number; questionCount: number; scorePercent: number } {
  const questions = questionsFor(skillCode);
  const correctCount = questions.filter((q) => chosen[q.id] === q.answer).length;
  const questionCount = questions.length;
  return {
    correctCount,
    questionCount,
    scorePercent: questionCount === 0 ? 0 : Math.round((correctCount / questionCount) * 100),
  };
}

/** The browser-safe shape: prompt and options, no answer key. */
export type PublicQuestion = Omit<SkillQuestion, "answer" | "why" | "whyHi">;

export function publicQuestionsFor(skillCode: string): PublicQuestion[] {
  // Built by naming the fields to keep rather than the ones to drop. A rest
  // spread would silently leak any answer-bearing field added to
  // SkillQuestion later; this way a new field has to be added here on purpose
  // before it can reach the browser.
  return questionsFor(skillCode).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    promptHi: q.promptHi,
    options: q.options,
    optionsHi: q.optionsHi,
  }));
}
