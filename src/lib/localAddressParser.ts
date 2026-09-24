import { districtThanaMap } from "@/data/bangladeshLocations";

// English to Bangla district name mapping for common cases
export const englishToBanglaDistrict: Record<string, string> = {
  dhaka: "ঢাকা", chittagong: "চট্টগ্রাম", chattogram: "চট্টগ্রাম", rajshahi: "রাজশাহী",
  khulna: "খুলনা", sylhet: "সিলেট", barisal: "বরিশাল", barishal: "বরিশাল",
  rangpur: "রংপুর", mymensingh: "ময়মনসিংহ", comilla: "কুমিল্লা", cumilla: "কুমিল্লা",
  gazipur: "গাজীপুর", narayanganj: "নারায়ণগঞ্জ", manikganj: "মানিকগঞ্জ",
  munshiganj: "মুন্সিগঞ্জ", narsingdi: "নরসিংদী", tangail: "টাঙ্গাইল",
  kishoreganj: "কিশোরগঞ্জ", faridpur: "ফরিদপুর", madaripur: "মাদারীপুর",
  shariatpur: "শরীয়তপুর", gopalganj: "গোপালগঞ্জ", rajbari: "রাজবাড়ী", jamalpur: "জামালপুর",
  sherpur: "শেরপুর", netrokona: "নেত্রকোনা", bogra: "বগুড়া", bogura: "বগুড়া",
  naogaon: "নওগাঁ", natore: "নাটোর", chapainawabganj: "চাঁপাইনবাবগঞ্জ",
  pabna: "পাবনা", sirajganj: "সিরাজগঞ্জ", joypurhat: "জয়পুরহাট",
  dinajpur: "দিনাজপুর", gaibandha: "গাইবান্ধা", kurigram: "কুড়িগ্রাম",
  lalmonirhat: "লালমনিরহাট", nilphamari: "নীলফামারী", thakurgaon: "ঠাকুরগাঁও",
  panchagarh: "পঞ্চগড়", jessore: "যশোর", jashore: "যশোর",
  satkhira: "সাতক্ষীরা", jhenaidah: "ঝিনাইদহ", jhenaidaha: "ঝিনাইদহ",
  magura: "মাগুরা", narail: "নড়াইল", kushtia: "কুষ্টিয়া",
  meherpur: "মেহেরপুর", chuadanga: "চুয়াডাঙ্গা", bagerhat: "বাগেরহাট",
  jhalokathi: "ঝালকাঠি", jhalokati: "ঝালকাঠি", patuakhali: "পটুয়াখালী",
  pirojpur: "পিরোজপুর", bhola: "ভোলা", barguna: "বরগুনা",
  habiganj: "হবিগঞ্জ", moulvibazar: "মৌলভীবাজার", sunamganj: "সুনামগঞ্জ",
  coxsbazar: "কক্সবাজার", "cox's bazar": "কক্সবাজার",
  rangamati: "রাঙ্গামাটি", khagrachhari: "খাগড়াছড়ি", khagrachari: "খাগড়াছড়ি",
  bandarban: "বান্দরবান", feni: "ফেনী", lakshmipur: "লক্ষ্মীপুর",
  noakhali: "নোয়াখালী", brahmanbaria: "ব্রাহ্মণবাড়িয়া", chandpur: "চাঁদপুর",
};

export interface LocalParseResult {
  district: string;
  thana: string;
  area: string;
  confidence: "high" | "medium" | "low";
  confidenceScore: number; // 0-100
  matchDetails: string; // human-readable explanation of how it matched
}

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/[,.\-।\/\\]+/g, " ").replace(/\s+/g, " ");
}

// Rough Bangla-to-Roman transliteration for fuzzy thana matching
const bnToRomMap: [RegExp, string][] = [
  [/ক্ষ/g, "kkh"], [/জ্ঞ/g, "gn"], [/ঞ্চ/g, "nch"], [/ঞ্জ/g, "nj"],
  [/ং/g, "ng"], [/ঃ/g, "h"], [/ঁ/g, "n"],
  [/খ/g, "kh"], [/ঘ/g, "gh"], [/ছ/g, "ch"], [/ঝ/g, "jh"],
  [/ঞ/g, "n"], [/ঠ/g, "th"], [/ঢ/g, "dh"], [/ণ/g, "n"],
  [/থ/g, "th"], [/ধ/g, "dh"], [/ফ/g, "f"], [/ভ/g, "bh"],
  [/শ/g, "sh"], [/ষ/g, "sh"], [/স/g, "s"],
  [/চ/g, "ch"], [/ট/g, "t"], [/ত/g, "t"], [/দ/g, "d"],
  [/ড়/g, "r"], [/ড/g, "d"], [/ন/g, "n"], [/প/g, "p"], [/ব/g, "b"], [/ম/g, "m"],
  [/য়/g, "y"], [/য/g, "j"], [/র/g, "r"], [/ল/g, "l"], [/ক/g, "k"],
  [/গ/g, "g"], [/জ/g, "j"], [/হ/g, "h"], [/ঢ়/g, "rh"], [/ৎ/g, "t"],
  [/া/g, "a"], [/ি/g, "i"], [/ী/g, "i"], [/ু/g, "u"], [/ূ/g, "u"],
  [/ে/g, "e"], [/ৈ/g, "oi"], [/ো/g, "o"], [/ৌ/g, "ou"],
  [/অ/g, "a"], [/আ/g, "a"], [/ই/g, "i"], [/ঈ/g, "i"],
  [/উ/g, "u"], [/ঊ/g, "u"], [/এ/g, "e"], [/ঐ/g, "oi"],
  [/ও/g, "o"], [/ঔ/g, "ou"], [/ৃ/g, "ri"],
  [/্/g, ""], [/়/g, ""],
];

function banglaToRoughRoman(bangla: string): string[] {
  let r = bangla;
  for (const [pat, rep] of bnToRomMap) {
    r = r.replace(pat, rep);
  }
  r = r.replace(/[^\w]/g, "").toLowerCase();
  return r ? [r] : [];
}

// Check if a thana name exists in multiple districts (ambiguous)
function countThanaOccurrences(thanaName: string): number {
  let count = 0;
  const normalizedThana = normalize(thanaName);
  for (const thanas of Object.values(districtThanaMap)) {
    if (thanas.some(t => normalize(t) === normalizedThana)) {
      count++;
    }
  }
  return count;
}

// Check if a word boundary match exists (not a substring of a larger word)
function isWordBoundaryMatch(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[\\s,।\\.\\-\\/])${escaped}(?:[\\s,।\\.\\-\\/]|$)`, "i");
  return regex.test(text);
}

export function parseAddressLocally(addressText: string): LocalParseResult | null {
  if (!addressText.trim()) return null;

  const normalized = normalize(addressText);
  const allDistricts = Object.keys(districtThanaMap);
  
  let foundDistrict = "";
  let foundThana = "";
  let area = "";
  let score = 0;
  let matchDetails = "";
  let districtMatchType: "bangla_exact" | "english_exact" | "thana_inferred" | "" = "";
  let thanaMatchType: "bangla_exact" | "fuzzy_roman" | "sadar" | "" = "";

  // 1. Try matching district names (Bangla) - word boundary preferred
  for (const dist of allDistricts) {
    const normalizedDist = normalize(dist);
    if (normalizedDist.length >= 3 && isWordBoundaryMatch(normalized, normalizedDist)) {
      foundDistrict = dist;
      districtMatchType = "bangla_exact";
      score += 40;
      break;
    }
  }
  // Fallback: substring match for Bangla district
  if (!foundDistrict) {
    for (const dist of allDistricts) {
      if (normalized.includes(normalize(dist))) {
        foundDistrict = dist;
        districtMatchType = "bangla_exact";
        score += 30; // lower score for substring
        break;
      }
    }
  }

  // 2. Try English district names
  if (!foundDistrict) {
    for (const [eng, bangla] of Object.entries(englishToBanglaDistrict)) {
      if (eng.length >= 4 && isWordBoundaryMatch(normalized, eng)) {
        foundDistrict = bangla;
        districtMatchType = "english_exact";
        score += 35;
        break;
      }
    }
    // Fallback substring for English
    if (!foundDistrict) {
      for (const [eng, bangla] of Object.entries(englishToBanglaDistrict)) {
        if (eng.length >= 5 && normalized.includes(eng)) {
          foundDistrict = bangla;
          districtMatchType = "english_exact";
          score += 25;
          break;
        }
      }
    }
  }

  // 3. If district found, try matching thana
  if (foundDistrict) {
    const thanas = districtThanaMap[foundDistrict] || [];
    
    // 3a. Exact Bangla thana match (word boundary preferred)
    for (const th of thanas) {
      const normalizedTh = normalize(th);
      if (normalizedTh.length >= 3 && isWordBoundaryMatch(normalized, normalizedTh)) {
        foundThana = th;
        thanaMatchType = "bangla_exact";
        score += 40;
        break;
      }
    }
    // Fallback: substring match for Bangla thana
    if (!foundThana) {
      for (const th of thanas) {
        const normalizedTh = normalize(th);
        if (normalizedTh.length >= 4 && normalized.includes(normalizedTh)) {
          foundThana = th;
          thanaMatchType = "bangla_exact";
          score += 30;
          break;
        }
      }
    }

    // 3b. Fuzzy English thana matching (only if min 5 chars to reduce false positives)
    if (!foundThana) {
      for (const th of thanas) {
        const thClean = normalize(th).replace(/\s*সদর$/, "").trim();
        const romanized = banglaToRoughRoman(thClean);
        for (const rom of romanized) {
          if (rom.length >= 5 && isWordBoundaryMatch(normalized, rom)) {
            foundThana = th;
            thanaMatchType = "fuzzy_roman";
            score += 25;
            break;
          }
        }
        if (foundThana) break;
      }
      // Substring fallback for fuzzy (higher min length)
      if (!foundThana) {
        for (const th of thanas) {
          const thClean = normalize(th).replace(/\s*সদর$/, "").trim();
          const romanized = banglaToRoughRoman(thClean);
          for (const rom of romanized) {
            if (rom.length >= 6 && normalized.includes(rom)) {
              foundThana = th;
              thanaMatchType = "fuzzy_roman";
              score += 15; // low score for substring fuzzy
              break;
            }
          }
          if (foundThana) break;
        }
      }
    }

    // 3c. Check "সদর" shorthand
    if (!foundThana && normalized.includes("সদর")) {
      const sadarThana = thanas.find(t => t.includes("সদর"));
      if (sadarThana) {
        foundThana = sadarThana;
        thanaMatchType = "sadar";
        score += 20;
      }
    }
  }

  // 4. If no district but thana matches — find unique thana across all districts
  if (!foundDistrict) {
    type ThanaMatch = { district: string; thana: string; matchType: "bangla_exact" | "fuzzy_roman"; romLen: number };
    const matches: ThanaMatch[] = [];

    for (const [dist, thanas] of Object.entries(districtThanaMap)) {
      for (const th of thanas) {
        const normalizedTh = normalize(th);
        if (normalizedTh.length >= 4 && isWordBoundaryMatch(normalized, normalizedTh)) {
          matches.push({ district: dist, thana: th, matchType: "bangla_exact", romLen: normalizedTh.length });
        }
      }
    }

    // If no Bangla match, try fuzzy (higher threshold)
    if (matches.length === 0) {
      for (const [dist, thanas] of Object.entries(districtThanaMap)) {
        for (const th of thanas) {
          const thClean = normalize(th).replace(/\s*সদর$/, "").trim();
          const romanized = banglaToRoughRoman(thClean);
          for (const rom of romanized) {
            if (rom.length >= 6 && isWordBoundaryMatch(normalized, rom)) {
              matches.push({ district: dist, thana: th, matchType: "fuzzy_roman", romLen: rom.length });
            }
          }
        }
      }
    }

    if (matches.length === 1) {
      // Unique match - good confidence
      foundDistrict = matches[0].district;
      foundThana = matches[0].thana;
      districtMatchType = "thana_inferred";
      thanaMatchType = matches[0].matchType;
      score += matches[0].matchType === "bangla_exact" ? 50 : 30;
    } else if (matches.length > 1) {
      // Multiple matches - ambiguous, pick first but low confidence
      foundDistrict = matches[0].district;
      foundThana = matches[0].thana;
      districtMatchType = "thana_inferred";
      thanaMatchType = matches[0].matchType;
      score += 10; // very low score for ambiguous
    }
  }

  if (!foundDistrict) return null;

  // 5. Extract area
  let remaining = addressText;
  if (foundThana) remaining = remaining.replace(new RegExp(foundThana.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), "");
  remaining = remaining.replace(new RegExp(foundDistrict.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), "");
  for (const [eng, bangla] of Object.entries(englishToBanglaDistrict)) {
    if (bangla === foundDistrict) {
      remaining = remaining.replace(new RegExp(`\\b${eng}\\b`, "gi"), "");
    }
  }
  area = remaining.replace(/[,.\-।\/\\]+/g, " ").replace(/\s+/g, " ").trim();

  // Build match details
  const parts: string[] = [];
  if (districtMatchType === "bangla_exact") parts.push(`জেলা: বাংলা ম্যাচ`);
  else if (districtMatchType === "english_exact") parts.push(`জেলা: ইংরেজি ম্যাচ`);
  else if (districtMatchType === "thana_inferred") parts.push(`জেলা: থানা থেকে অনুমান`);
  
  if (thanaMatchType === "bangla_exact") parts.push(`থানা: বাংলা ম্যাচ`);
  else if (thanaMatchType === "fuzzy_roman") parts.push(`থানা: ফাজি ম্যাচ ⚠️`);
  else if (thanaMatchType === "sadar") parts.push(`থানা: সদর`);
  else if (!foundThana) parts.push(`থানা: পাওয়া যায়নি ⚠️`);
  
  matchDetails = parts.join(" · ");

  // Clamp score and determine confidence
  const confidenceScore = Math.min(100, Math.max(0, score));
  const confidence: "high" | "medium" | "low" = 
    confidenceScore >= 60 ? "high" : 
    confidenceScore >= 30 ? "medium" : "low";

  return { district: foundDistrict, thana: foundThana, area, confidence, confidenceScore, matchDetails };
}
