import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Brain, FileText, Calendar, MapPin, Phone, Mail, CheckCircle2, Download, Receipt, Activity } from "lucide-react";
import CogniTrackXReport from "@/components/report/CogniTrackXReport";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PatientLookup from "@/components/PatientLookup";
import BillingInvoice from "@/components/billing/BillingInvoice";

// ─── Neurocognitive data & helpers ───────────────────────────────────────────
const DOMAIN_CATEGORIES = {
  nci:                  "index",
  neurocognitive_index: "index",
  memory:               "memory",
  verbal_memory:        "memory",
  visual_memory:        "memory",
  psychomotor_speed:    "speed",
  reaction_time:        "speed",
  complex_attention:    "attention",
  cognitive_flexibility:"attention",
  processing_speed:     "speed",
  executive_function:   "executive",
  executive_functioning:"executive",
  working_memory:       "memory",
  sustained_attention:  "attention",
  simple_attention:     "attention",
  motor_speed:          "speed",
  social_acuity:        "executive",
  reasoning:            "executive",
};

function buildNeroDomainsFromPhaseData(phaseData) {
  if (!phaseData?.domains) return [];
  const DOMAIN_LABELS = {
    nci: "Neurocognitive Index",
    neurocognitive_index: "Neurocognitive Index",
    memory: "Memory",
    verbal_memory: "Verbal Memory",
    visual_memory: "Visual Memory",
    psychomotor_speed: "Psychomotor Speed",
    reaction_time: "Reaction Time",
    complex_attention: "Complex Attention",
    cognitive_flexibility: "Cognitive Flexibility",
    processing_speed: "Processing Speed",
    executive_function: "Executive Function",
    executive_functioning: "Executive Functioning",
    working_memory: "Working Memory",
    sustained_attention: "Sustained Attention",
    simple_attention: "Simple Attention",
    motor_speed: "Motor Speed",
    social_acuity: "Social Acuity",
    reasoning: "Reasoning",
  };
  // Only return the named/summary domains, not raw sub-test fields
  const KNOWN_DOMAINS = new Set(Object.keys(DOMAIN_LABELS));
  return Object.entries(phaseData.domains)
    .filter(([key]) => KNOWN_DOMAINS.has(key))
    .map(([key, d]) => ({
      key,
      label: DOMAIN_LABELS[key] || key.replace(/_/g, " "),
      score: d.ss,
      percentile: d.pr,
      valid: d.valid,
      category: DOMAIN_CATEGORIES[key] || "index",
    }));
}

const CAT_COLORS = {
  index:     { light: "bg-cyan-50 border-cyan-200",     badge: "bg-cyan-100 text-cyan-700" },
  memory:    { light: "bg-blue-50 border-blue-200",     badge: "bg-blue-100 text-blue-700" },
  speed:     { light: "bg-teal-50 border-teal-200",     badge: "bg-teal-100 text-teal-700" },
  attention: { light: "bg-amber-50 border-amber-200",   badge: "bg-amber-100 text-amber-700" },
  executive: { light: "bg-indigo-50 border-indigo-200", badge: "bg-indigo-100 text-indigo-700" },
};
const CAT_LABELS = { index:"Index", memory:"Memory", speed:"Speed", attention:"Attention", executive:"Executive" };

function getRange(p) {
  if (p <= 2)  return { label: "Very Low",     color: "bg-red-500",     text: "text-red-600" };
  if (p <= 8)  return { label: "Low",           color: "bg-orange-500",  text: "text-orange-600" };
  if (p <= 24) return { label: "Low Average",   color: "bg-yellow-500",  text: "text-yellow-600" };
  if (p <= 74) return { label: "Average",       color: "bg-green-500",   text: "text-green-600" };
  return              { label: "Above Average", color: "bg-emerald-500", text: "text-emerald-600" };
}
function getPct(p) {
  if (p <= 2)  return (p / 2) * 20;
  if (p <= 8)  return 20 + ((p - 2) / 6) * 20;
  if (p <= 24) return 40 + ((p - 8) / 16) * 20;
  if (p <= 74) return 60 + ((p - 24) / 50) * 20;
  return              80 + ((p - 74) / 26) * 20;
}

function DomainRow({ domain, index }) {
  const p1 = domain.phase1;
  const p2 = domain.phase2;
  const active = p2 ?? domain; // use phase2 if available, else the domain itself (phase1-only)
  const hasPercentile = active?.percentile != null;
  const range = hasPercentile ? getRange(active.percentile) : null;
  const pct   = hasPercentile ? getPct(active.percentile) : null;
  const pct1  = p1?.percentile != null ? getPct(p1.percentile) : null;
  const cat   = CAT_COLORS[domain.category];
  const isComparison = p1 != null && p2 != null;

  // change indicator
  const diff = isComparison ? (p2.score ?? 0) - (p1.score ?? 0) : null;

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${cat.light} ${index % 2 === 0 ? "" : "bg-opacity-50"}`}>
      <div className="w-44 shrink-0">
        <p className="text-slate-800 font-semibold text-sm leading-tight">{domain.key === "nci" ? "NCI" : domain.label}</p>
        <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0 rounded font-semibold ${cat.badge}`}>{CAT_LABELS[domain.category]}</span>
      </div>

      {/* Phase 1 score (shown when comparison mode) */}
      {isComparison ? (
        <div className="w-16 shrink-0 text-center">
          <span className="text-lg font-black text-slate-400">{p1.score ?? "—"}</span>
          {p1.percentile != null && (
            <p className={`text-[10px] font-bold ${getRange(p1.percentile).text}`}>{p1.percentile}%</p>
          )}
        </div>
      ) : (
        <div className="w-16 shrink-0 text-center">
          <span className="text-xl font-black text-slate-900">{active?.score ?? "—"}</span>
        </div>
      )}

      {/* Change arrow (comparison only) */}
      {isComparison && (
        <div className="w-12 shrink-0 text-center">
          {diff == null ? (
            <span className="text-slate-300 text-xs font-medium">—</span>
          ) : Math.abs(diff) < 2 ? (
            <span className="text-slate-400 text-xs font-bold">±0</span>
          ) : diff > 0 ? (
            <span className="text-emerald-600 text-xs font-bold">↑+{diff}</span>
          ) : (
            <span className="text-red-500 text-xs font-bold">↓{diff}</span>
          )}
        </div>
      )}

      {/* Phase 2 score (or single score when no comparison) */}
      {isComparison && (
        <div className="w-16 shrink-0 text-center">
          <span className="text-xl font-black text-slate-900">{p2.score ?? "—"}</span>
          {p2.percentile != null && (
            <p className={`text-[10px] font-bold ${range?.text}`}>{p2.percentile}%</p>
          )}
        </div>
      )}

      {/* Percentile column (single-phase only) */}
      {!isComparison && (
        <div className="w-20 shrink-0 text-center">
          <span className={`text-sm font-bold ${range?.text ?? "text-slate-400"}`}>{hasPercentile ? `${active.percentile}%` : "—"}</span>
        </div>
      )}

      <div className="w-14 shrink-0 text-center">
        {active?.valid == null
          ? <span className="text-slate-300 text-xs">—</span>
          : active.valid
            ? <span className="text-emerald-600 text-xs font-semibold">Yes</span>
            : <span className="text-slate-400 text-xs">No</span>}
      </div>

      <div className="flex-1 min-w-0">
        {hasPercentile && (
          <>
            <div className="flex gap-0.5 h-6 rounded-lg overflow-hidden">
              {[
                { bg: "bg-red-100", text: "text-red-400", label: "V.Low" },
                { bg: "bg-orange-100", text: "text-orange-400", label: "Low" },
                { bg: "bg-yellow-100", text: "text-yellow-500", label: "Low Avg" },
                { bg: "bg-green-100", text: "text-green-600", label: "Average" },
                { bg: "bg-emerald-100", text: "text-emerald-600", label: "Above" },
              ].map(z => (
                <div key={z.label} className={`flex-1 ${z.bg} flex items-center justify-center`}>
                  <span className={`text-[8px] ${z.text} font-semibold px-0.5 whitespace-nowrap`}>{z.label}</span>
                </div>
              ))}
            </div>
            <div className="relative h-2 mt-0.5">
              {isComparison && pct1 != null && (
                <div className="absolute -mt-0.5 h-2.5 w-2.5 -ml-1.5 rounded-full border-2 border-white shadow opacity-40 bg-slate-500" style={{ left: `${pct1}%` }} />
              )}
              <div className="absolute -mt-0.5 h-3 w-3 -ml-1.5 rounded-full border-2 border-white shadow-lg" style={{ left: `${pct}%` }}>
                <div className={`w-full h-full rounded-full ${range.color}`} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="w-20 shrink-0 text-right">
        <span className={`text-xs font-bold ${range?.text ?? "text-slate-400"}`}>{range?.label ?? "—"}</span>
      </div>
    </div>
  );
}

// ─── Neurobehavioral data ─────────────────────────────────────────────────────
const DEFAULT_BEHAV_DOMAINS = [
  { category: "SLEEP", metrics: [
    { label: "Fatigue", tool: "NIH PROMIS CAT", scoreKey: "fatigue", rawKey: "fatigue_raw" },
    { label: "NIH PROMIS – Sleep Disturbance", tool: "NIH PROMIS CAT Neuro-QOL", scoreKey: "sleep_disturbance", rawKey: "sleep_disturbance_raw" },
  ]},
  { category: "CHRONIC PAIN", metrics: [
    { label: "Brief Pain Inventory (BPI) – Pain Interference", tool: "BPI - Pain Interference", scoreKey: "pain_interference", rawKey: "pain_interference_raw" },
  ]},
  { category: "NEUROLOGICAL", metrics: [
    { label: "Quality of Life After Brain Injury", tool: "Abilities After Brain Injury Questionnaire", scoreKey: "qol_brain_injury", rawKey: "qol_brain_injury_raw" },
  ]},
  { category: "NEUROLOGICAL", metrics: [
    { label: "Post Concussion Symptoms", tool: "PCS", scoreKey: "post_concussion_symptoms", rawKey: "post_concussion_symptoms_raw" },
    { label: "Headache Impact Test", tool: "HIT-6", scoreKey: "headache_impact", rawKey: "headache_impact_raw" },
  ]},
  { category: "MENTAL HEALTH", metrics: [
    { label: "General Anxiety Disorder (GAD-7)", tool: "GAD-7", scoreKey: "gad7", rawKey: "gad7_raw" },
    { label: "Depression – PHQ-9", tool: "PHQ-9", scoreKey: "phq9", rawKey: "phq9_raw" },
  ]},
  { category: "MENTAL HEALTH", metrics: [
    { label: "PCL-5 Weekly", tool: "PCL-5 Weekly", scoreKey: "pcl5", rawKey: "pcl5_raw" },
    { label: "NIH PROMIS CAT Neuro-QOL Cognition", tool: "NIH PROMIS CAT Neuro-QOL", scoreKey: "neuroqol_cognition", rawKey: "neuroqol_cognition_raw" },
  ]},
];

function buildBehavDomains(resultsData, assessmentType) {
  const isPhase2Report = assessmentType === "sentinel_phase2";
  const timepoint = isPhase2Report ? "phase2" : "phase1";
  const nb2 = resultsData?.[`neurobehavioral_${timepoint}`] || {};
  // Only pull Phase 1 comparison data when we are actually viewing a Phase 2 report
  const nb1 = isPhase2Report ? (resultsData?.["neurobehavioral_phase1"] || {}) : {};
  const hasPhase1 = isPhase2Report && Object.keys(nb1).length > 0;
  return DEFAULT_BEHAV_DOMAINS.map(section => ({
    ...section,
    metrics: section.metrics.map(m => ({
      ...m,
      score: nb2[m.scoreKey] != null ? nb2[m.scoreKey] : (Object.keys(nb2).length > 0 ? 0 : null),
      raw: nb2[m.rawKey] != null ? `Raw = ${nb2[m.rawKey]}` : null,
      phase1Score: hasPhase1 ? (nb1[m.scoreKey] != null ? nb1[m.scoreKey] : (Object.keys(nb1).length > 0 ? 0 : null)) : null,
      phase1Raw: nb1[m.rawKey] != null ? `Raw = ${nb1[m.rawKey]}` : null,
    })),
  }));
}

function ScoreCard({ metric }) {
  const hasP2 = metric.score != null;
  const hasP1 = metric.phase1Score != null;
  const isComparison = hasP1 && hasP2;
  const diff = isComparison ? metric.score - metric.phase1Score : null;

  const barColor = (score) => {
    if (score == null) return "bg-slate-200";
    if (score >= 80) return "bg-red-400";
    if (score >= 60) return "bg-amber-400";
    if (score >= 40) return "bg-cyan-400";
    return "bg-emerald-400";
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex-1 min-w-[150px]">
      <p className="text-slate-500 text-xs font-medium leading-tight">{metric.label}</p>

      {isComparison ? (
        <div className="flex items-end gap-2 mt-1">
          <div className="text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Ph.1</p>
            <p className="text-xl font-bold text-slate-400">{metric.phase1Score}</p>
          </div>
          <div className="pb-1 text-center">
            {diff == null ? (
              <span className="text-slate-300 text-xs">—</span>
            ) : Math.abs(diff) < 2 ? (
              <span className="text-slate-400 text-[10px] font-bold">±0</span>
            ) : diff < 0 ? (
              <span className="text-emerald-600 text-[10px] font-bold">↓{diff.toFixed(2)}</span>
            ) : (
              <span className="text-red-500 text-[10px] font-bold">↑+{diff.toFixed(2)}</span>
            )}
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold text-cyan-600 uppercase tracking-wide">Ph.2</p>
            <p className="text-2xl font-black text-slate-800">{metric.score}</p>
          </div>
        </div>
      ) : (
        <p className="text-3xl font-bold text-slate-800 mt-1">{hasP2 ? metric.score : "—"}</p>
      )}

      <div className="mt-2 space-y-1.5">
        {isComparison && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400 w-4">P1</span>
            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
              <div className="bg-slate-300 h-1.5 rounded-full" style={{ width: `${Math.min(metric.phase1Score, 100)}%` }} />
            </div>
            <span className="text-[9px] text-slate-400 w-5 text-right">{metric.phase1Score}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {isComparison && <span className="text-[9px] text-cyan-600 w-4 font-semibold">P2</span>}
          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
            <div className={`${barColor(metric.score)} h-1.5 rounded-full`} style={{ width: hasP2 ? `${Math.min(metric.score, 100)}%` : "0%" }} />
          </div>
          {isComparison && <span className="text-[9px] text-slate-600 w-5 text-right font-semibold">{metric.score}</span>}
        </div>
        <p className="text-slate-400 text-[10px] mt-1">{metric.tool}</p>
        {metric.raw && <p className="text-slate-400 text-[10px]">{metric.raw}</p>}
      </div>
    </div>
  );
}

function BehavSection({ category, metrics }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-1.5 text-center">
        <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">{category}</p>
      </div>
      <div className="p-3 flex gap-3 flex-wrap">
        {metrics.map((m, i) => <ScoreCard key={i} metric={m} />)}
      </div>
    </div>
  );
}

// ─── Treatment recommendations ────────────────────────────────────────────────
const RECOMMENDATIONS = [
  { num: 1, title: "Cognitive Rehabilitation", items: [
    "Initiate structured cognitive therapy targeting attention, processing speed, and executive functioning.",
    "Incorporate evidence-based strategies for compensatory skill development, task sequencing, and activity pacing.",
    "Consider referral to occupational or speech-language therapy for advanced cognitive rehabilitation.",
  ]},
  { num: 2, title: "Behavioral Health and Emotional Regulation", items: [
    "Refer to a licensed behavioral health provider with expertise in post-injury adjustment and trauma-informed care.",
    "Implement psychotherapy as clinically indicated to address mood dysregulation, anxiety, or depressive features.",
    "Coordinate with primary care or psychiatry for pharmacologic management if symptoms persist or impair function.",
  ]},
  { num: 3, title: "Headache Management", items: [
    "Initiate multimodal headache protocol including hydration, nutrition optimization, and sleep regulation.",
    "Prescribe appropriate pharmacologic agents if conservative measures are insufficient.",
    "Refer to neurology for advanced management in the event of refractory or chronic headache presentation.",
  ]},
  { num: 4, title: "Sleep Medicine Intervention", items: [
    "Establish a consistent circadian rhythm through fixed sleep–wake cycles.",
    "Recommend elimination of pre-sleep stimulants and structured sleep hygiene practices.",
    "Refer to sleep medicine for further evaluation if insomnia, hypersomnia, or other disturbances persist.",
  ]},
  { num: 5, title: "Functional Anxiety Management", items: [
    "Reinforce adaptive behavioral strategies to maintain safety and restore confidence in functional tasks.",
    "Initiate short-course cognitive-behavioral therapy when anxiety presents as impairing or avoidant.",
    "Monitor closely for post-traumatic stress features and escalate to specialty care as appropriate.",
  ]},
  { num: 6, title: "Psychoeducation and Patient Counseling", items: [
    "Provide structured education on the neurological, cognitive, and behavioral sequelae of mild TBI.",
    "Emphasize the importance of pacing, structured recovery routines, and adherence to treatment protocols.",
    "Reinforce expected recovery timelines while highlighting the need for proactive management of symptoms.",
  ]},
  { num: 7, title: "Ongoing Monitoring and Care Coordination", items: [
    "Schedule regular follow-up to reassess neurocognitive, behavioral, and somatic outcomes.",
    "Modify treatment plan responsively to patient progress and functional status.",
    "Ensure multidisciplinary care coordination across neurology, rehabilitation, and behavioral health providers.",
  ]},
  { num: 8, title: "Photobiomodulation Therapy (PBM)", items: [
    "Initiate PBM protocol consisting of three whole-body sessions per week, supplemented by targeted cranial or cervical applications as clinically indicated.",
    "Objectives: reduce neuroinflammation, improve cerebral perfusion, enhance mitochondrial function, and support cognitive and emotional recovery.",
    "Monitor clinical response and adjust frequency or intensity per protocol.",
  ]},
  { num: 9, title: "Adjunctive and Regenerative Therapies", items: [
    "Evaluate appropriateness of regenerative medicine interventions, including stem cell consultation, for patients with persistent or refractory symptoms.",
    "Limit use to evidence-based, physician-supervised settings compliant with regulatory standards.",
    "Incorporate adjunctive therapies into the care plan only when conservative measures have been optimized.",
  ]},
];

// ─── Page sections ────────────────────────────────────────────────────────────
function Section({ id, children }) {
  return (
    <div id={id} className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
      {children}
    </div>
  );
}

function SectionBanner({ gradient, title, subtitle }) {
  return (
    <div className={`${gradient} px-8 py-6`}>
      <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
      {subtitle && <p className="text-white/80 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPhaseLabel(type) {
  if (type === "sentinel_phase1") return "PHASE I";
  if (type === "sentinel_phase2") return "PHASE II";
  if (type === "cognitrackx") return "COGNITRACKX";
  return "UNKNOWN";
}

const isSentinel = (type) => type === "sentinel_phase1" || type === "sentinel_phase2";

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FullPatientReport() {
  const [assessment, setAssessment] = useState(null);
  const [allPatientAssessments, setAllPatientAssessments] = useState([]);
  const [activeAssessmentId, setActiveAssessmentId] = useState(null);
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [approving, setApproving] = useState(false);
  const [savingEvalDate, setSavingEvalDate] = useState(false);
  const [editingEvalDate, setEditingEvalDate] = useState(false);
  const [evalDateInput, setEvalDateInput] = useState("");
  const [cnsvsPhaseData, setCnsvsPhaseData] = useState(null);
  const [cnsvsPhase1Data, setCnsvsPhase1Data] = useState(null);
  const [phase1Assessment, setPhase1Assessment] = useState(null);
  const [cnsvsLoading, setCnsvsLoading] = useState(false);
  const [behavioralLoading, setBehavioralLoading] = useState(false);
  const [cognitrackxData, setCognitrackxData] = useState(null);
  const [cognitrackxLoading, setCognitrackxLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeView, setActiveView] = useState(null); // null = auto-detect on load
  const navigate = useNavigate();

  const params = new URLSearchParams(window.location.search);
  const assessmentId = params.get("id");
  const referralId = params.get("referral");

  // Keep activeAssessmentId in sync + auto-select the right view
  useEffect(() => {
    if (assessment) {
      setActiveAssessmentId(assessment.id);
      if (!activeView) {
        setActiveView(assessment.assessment_type === "cognitrackx" ? "cognitrackx" : "report");
      }
    }
  }, [assessment]);

  const loadAssessmentById = async (id) => {
    setLoading(true);
    setCnsvsPhaseData(null);
    setCnsvsPhase1Data(null);
    setCognitrackxData(null);
    setPhase1Assessment(null);
    try {
      // PatientAssessment.get by id
      const data = await base44.entities.PatientAssessment.filter({ id });
      const currentAssessment = data[0];
      if (!currentAssessment) throw new Error("Assessment not found");

      setAssessment(currentAssessment);

      // Fetch all assessments for this patient to populate the tabs
      if (currentAssessment.patient_id) {
        const all = await base44.entities.PatientAssessment.filter({ patient_id: currentAssessment.patient_id });
        setAllPatientAssessments(all);
        // Store phase 1 assessment for neurobehavioral comparison
        if (currentAssessment.assessment_type === "sentinel_phase2") {
          const p1 = all.find(a => a.assessment_type === "sentinel_phase1");
          if (p1) setPhase1Assessment(p1);
        }
      }

      // Referral
      if (referralId) {
        const refs = await base44.entities.Referral.filter({ id: referralId });
        if (refs[0]) setReferral(refs[0]);
      } else if (currentAssessment.patient_id) {
        const refs = await base44.entities.Referral.filter({ patient_id: currentAssessment.patient_id });
        if (refs[0]) setReferral(refs[0]);
      } else {
        setReferral(null);
      }

      const storedEvalDate = currentAssessment?.results_data?.evaluated_date || currentAssessment?.completed_at;
      if (storedEvalDate) {
        try { setEvalDateInput(format(new Date(storedEvalDate), "yyyy-MM-dd")); } catch {}
      }

      // Fetch CogniTrackX data for cognitrackx assessments
      if (currentAssessment?.patient_id && currentAssessment.assessment_type === "cognitrackx") {
        setCognitrackxLoading(true);
        try {
          const res = await base44.functions.invoke("getCognitrackXData", { subject_id: currentAssessment.patient_id });
          const rawData = res.data?.data || {};
          setCognitrackxData(rawData);
          // Persist into results_data
          const newResultsData = {
            ...(currentAssessment.results_data || {}),
            cognitrackx: { ...rawData, fetched_at: new Date().toISOString() },
          };
          setAssessment(prev => ({ ...prev, results_data: newResultsData }));
          const updatePayload = { results_data: newResultsData };
          if (currentAssessment.status !== "completed" && Object.keys(rawData).length > 0) {
            updatePayload.status = "completed";
            updatePayload.completed_at = new Date().toISOString();
            setAssessment(prev => ({ ...prev, status: "completed", completed_at: updatePayload.completed_at }));
          }
          await base44.entities.PatientAssessment.update(currentAssessment.id, updatePayload);
        } catch (e) {
          console.error("CogniTrackX data fetch failed:", e);
        } finally {
          setCognitrackxLoading(false);
        }
      }

      // Only fetch CNSVS + neuro data for sentinel assessments
      if (currentAssessment?.patient_id && isSentinel(currentAssessment.assessment_type)) {
        setCnsvsLoading(true);
        try {
          // Determine which phase to load from CnsvsPhaseData
          const phaseNumber = currentAssessment.assessment_type === "sentinel_phase2" ? 2 : 1;
          let phaseRecords = [];
          
          // Find the referral to get referral_id
          let refId = referralId;
          if (!refId) {
            const refs = await base44.entities.Referral.filter({ patient_id: currentAssessment.patient_id });
            refId = refs[0]?.id;
          }
          if (refId) {
            phaseRecords = await base44.entities.CnsvsPhaseData.filter({ referral_id: refId, phase: phaseNumber });

            // SELF-HEALING FIX: if no CnsvsPhaseData exists and assessment is completed,
            // auto-trigger computeCnsvsPhaseData and retry once
            if (phaseRecords.length === 0 && currentAssessment.status === "completed") {
              console.log(`No CnsvsPhaseData found for referral ${refId} phase ${phaseNumber} — auto-computing...`);
              try {
                await base44.functions.invoke("computeCnsvsPhaseData", { referral_id: refId });
                // Retry fetch after compute
                phaseRecords = await base44.entities.CnsvsPhaseData.filter({ referral_id: refId, phase: phaseNumber });
                console.log(`After auto-compute: found ${phaseRecords.length} phase record(s)`);
              } catch (computeErr) {
                console.error("Auto-compute of CnsvsPhaseData failed:", computeErr.message);
              }
            }

            if (phaseRecords.length > 0) {
              setCnsvsPhaseData(phaseRecords[0]);
            }
            // Always fetch Phase 1 for comparison (if this is Phase 2, show delta; Phase 1 shows its own data)
            if (phaseNumber === 2) {
              let phase1Records = await base44.entities.CnsvsPhaseData.filter({ referral_id: refId, phase: 1 });
              // Self-heal phase 1 as well if missing
              if (phase1Records.length === 0) {
                try {
                  await base44.functions.invoke("computeCnsvsPhaseData", { referral_id: refId });
                  phase1Records = await base44.entities.CnsvsPhaseData.filter({ referral_id: refId, phase: 1 });
                } catch (computeErr) {
                  console.error("Auto-compute of CnsvsPhaseData phase 1 failed:", computeErr.message);
                }
              }
              if (phase1Records.length > 0) {
                setCnsvsPhase1Data(phase1Records[0]);
              }
            }
          }

          // Fallback: if still no CnsvsPhaseData found, check results_data for manually assigned CNSVS data
          if (phaseRecords.length === 0) {
            const cnsvsFromResults = currentAssessment.results_data?.cnsvs;
            if (cnsvsFromResults?.domains) {
              // Convert results_data.cnsvs format to CnsvsPhaseData format
              setCnsvsPhaseData({
                domains: cnsvsFromResults.domains.reduce((acc, d) => {
                  acc[d.key] = { ss: d.ss, pr: d.pr, valid: d.valid };
                  return acc;
                }, {}),
                test_date_start: cnsvsFromResults.test_date,
              });
            }
          }
        } catch (e) {
          console.error("CnsvsPhaseData fetch failed:", e);
          setCnsvsPhaseData(null);
        } finally {
          setCnsvsLoading(false);
        }

        setBehavioralLoading(true);
        try {
          const timepoint = currentAssessment.assessment_type === "sentinel_phase2" ? "phase2" : "phase1";
          const timePointKey = `neurobehavioral_${timepoint}`;
          
          // Check if we already have neurobehavioral data in results_data (manually assigned)
          const existingData = currentAssessment.results_data?.[timePointKey];
          if (!existingData || Object.keys(existingData).length === 0) {
            // Fetch from API if not present
            const res = await base44.functions.invoke("getNeurobehavioralData", { subject_id: currentAssessment.patient_id });
            const rawPayload = res.data?.data !== undefined ? res.data.data : res.data;
            const newResultsData = {
              ...(currentAssessment.results_data || {}),
              [timePointKey]: { ...rawPayload, fetched_at: new Date().toISOString() }
            };
            setAssessment(prev => ({ ...prev, results_data: newResultsData }));
            await base44.entities.PatientAssessment.update(currentAssessment.id, { results_data: newResultsData });
          }
          // else: data already exists in results_data, no need to fetch
        } catch (e) {
          console.error("Neurobehavioral data fetch failed:", e);
        } finally {
          setBehavioralLoading(false);
        }
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const me = await base44.auth.me().catch(() => null);
      setUser(me);
      if (assessmentId) {
        await loadAssessmentById(assessmentId);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [assessmentId]);

  // Temporarily block access for specific user while report is being finalized
  const BLOCKED_EMAILS = [];
  if (user && BLOCKED_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-10 text-center">
          <Brain className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          <h2 className="text-white text-2xl font-bold mb-2">Report Coming Soon</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your patient report is currently being finalized by our clinical team. 
            You will be notified once it's ready for review.
          </p>
          <p className="text-slate-500 text-xs mt-4">Please check back shortly or contact Valhalla Health.</p>
        </div>
      </div>
    );
  }

  const handlePatientSelect = async (selectedAssessment) => {
    if (!selectedAssessment?.patient_id) return;
    const all = await base44.entities.PatientAssessment.filter({ patient_id: selectedAssessment.patient_id });
    setAllPatientAssessments(all);
    const initial = all.find(a => a.id === selectedAssessment.id) || all[0];
    if (initial) await loadAssessmentById(initial.id);
  };

  const handleTabChange = async (id) => {
    if (id === activeAssessmentId) return;
    await loadAssessmentById(id);
  };

  const handleSaveEvalDate = async () => {
    if (!evalDateInput || !assessment) return;
    setSavingEvalDate(true);
    await base44.entities.PatientAssessment.update(assessment.id, {
      results_data: { ...(assessment.results_data || {}), evaluated_date: evalDateInput },
    });
    setAssessment(prev => ({
      ...prev,
      results_data: { ...(prev.results_data || {}), evaluated_date: evalDateInput },
    }));
    setSavingEvalDate(false);
    setEditingEvalDate(false);
  };

  const VALHALLA_ROLES = ["Valhalla_Admin", "Valhalla_Clinical", "Valhalla_Intake"];
  const isValhalla = VALHALLA_ROLES.includes(user?.app_role) || VALHALLA_ROLES.includes(user?.role);

  const handleApprove = async () => {
    setApproving(true);
    const now = new Date().toISOString();
    await base44.entities.PatientAssessment.update(assessment.id, {
      approved_at: now,
      approved_by_id: user?.id,
      approved_by_name: user?.full_name || user?.email,
    });
    setAssessment(prev => ({ ...prev, approved_at: now, approved_by_name: user?.full_name || user?.email }));
    setApproving(false);
  };

  const backUrl = referralId
    ? createPageUrl("ReferralDetail") + `?id=${referralId}`
    : createPageUrl("ValhallaDashboard");

  const handleDownloadPdf = async () => {
    if (!assessment) return;
    setDownloadingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const bgColor = activeView === "cognitrackx" ? "#0f172a" : "#ffffff";

      // Helper: render an array of element IDs into the PDF, one section per page-group
      const renderSectionsToPdf = async (sectionIds, bg) => {
        let isFirstPage = true;
        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (!el || el.scrollHeight === 0) continue;
          const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: bg, logging: false });
          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          const renderedHeightMm = (canvas.height / canvas.width) * pageWidth;
          const numPages = Math.ceil(renderedHeightMm / pageHeight);
          for (let p = 0; p < numPages; p++) {
            if (!isFirstPage) pdf.addPage();
            isFirstPage = false;
            pdf.addImage(imgData, "JPEG", 0, -p * pageHeight, pageWidth, renderedHeightMm);
          }
        }
      };

      if (activeView === "cognitrackx") {
        const elements = document.querySelectorAll("[data-pdf-content]");
        const element = Array.from(elements).find(el => el.scrollHeight > 0 && el.style.display !== "none");
        if (!element) throw new Error("CogniTrackX content not found");
        const bg = "#0f172a";
        const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: bg, logging: false });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const renderedHeightMm = (canvas.height / canvas.width) * pageWidth;
        // Single continuous page sized to the full content height
        const singlePagePdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageWidth, renderedHeightMm] });
        singlePagePdf.setFillColor(15, 23, 42);
        singlePagePdf.rect(0, 0, pageWidth, renderedHeightMm, "F");
        singlePagePdf.addImage(imgData, "JPEG", 0, 0, pageWidth, renderedHeightMm);
        const viewLabel = "CogniTrackX";
        const patientSlug2 = (patientDisplay || "Patient").replace(/\s+/g, "_");
        singlePagePdf.save(`Valhalla_${viewLabel}_${patientSlug2}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
        setDownloadingPdf(false);
        return;
      }
      
      if (activeView === "invoice") {
        const elements = document.querySelectorAll("[data-pdf-content]");
        const element = Array.from(elements).find(el => el.scrollHeight > 0 && el.style.display !== "none");
        if (!element) throw new Error("Invoice content not found");
        const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff", logging: false });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const renderedHeightMm = (canvas.height / canvas.width) * pageWidth;
        const numPages = Math.ceil(renderedHeightMm / pageHeight);
        for (let p = 0; p < numPages; p++) {
          if (p > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, -p * pageHeight, pageWidth, renderedHeightMm);
        }
      } else {
        // For the report view: capture entire content as a single continuous page
        const elements = document.querySelectorAll("[data-pdf-content]");
        const element = Array.from(elements).find(el => el.scrollHeight > 0 && el.style.display !== "none");
        if (!element) throw new Error("Report content not found");
        
        const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff", logging: false });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const renderedHeightMm = (canvas.height / canvas.width) * pageWidth;
        
        // Single continuous page sized to the full content height
        const singlePagePdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageWidth, renderedHeightMm] });
        singlePagePdf.addImage(imgData, "JPEG", 0, 0, pageWidth, renderedHeightMm);
        
        const viewLabel = "Report";
        const patientSlug = (patientDisplay || "Patient").replace(/\s+/g, "_");
        singlePagePdf.save(`Valhalla_${viewLabel}_${patientSlug}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
        setDownloadingPdf(false);
        return;
      }

      const viewLabel = activeView === "cognitrackx" ? "CogniTrackX" : activeView === "invoice" ? "Invoice" : "Report";
      const patientSlug = (patientDisplay || "Patient").replace(/\s+/g, "_");
      pdf.save(`Valhalla_${viewLabel}_${patientSlug}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (e) {
      console.error("PDF download failed:", e);
      alert("Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

  const patientFirstLast = referral
    ? `${referral.patient_first_name || ""} ${referral.patient_last_name || ""}`.trim()
    : assessment?.patient_first_name
      ? `${assessment.patient_first_name} ${assessment.patient_last_name || ""}`.trim()
      : "Patient";

  const firstName = referral?.patient_first_name || assessment?.patient_first_name || "";
  const lastName  = referral?.patient_last_name  || assessment?.patient_last_name  || "";
  const patientDisplay = lastName ? `${firstName.charAt(0)}. ${lastName.toUpperCase()}` : firstName;

  const assessedDate = assessment?.completed_at || assessment?.created_date;
  const evaluatedDate = assessment?.results_data?.evaluated_date || assessment?.completed_at;
  const currentPhaseLabel = getPhaseLabel(assessment?.assessment_type);
  const isSentinelAssessment = isSentinel(assessment?.assessment_type);

  const NEURO_DOMAINS_P2 = buildNeroDomainsFromPhaseData(cnsvsPhaseData);
  const NEURO_DOMAINS_P1 = buildNeroDomainsFromPhaseData(cnsvsPhase1Data);
  const isPhase2 = assessment?.assessment_type === "sentinel_phase2";
  const hasComparison = isPhase2 && NEURO_DOMAINS_P1.length > 0 && NEURO_DOMAINS_P2.length > 0;

  // Merge domains: each entry gets phase1 and phase2 sub-objects when both exist
  const NEURO_DOMAINS = (NEURO_DOMAINS_P2.length > 0 ? NEURO_DOMAINS_P2 : NEURO_DOMAINS_P1).map(d => {
    const d1 = NEURO_DOMAINS_P1.find(x => x.key === d.key);
    const d2 = NEURO_DOMAINS_P2.find(x => x.key === d.key);
    return {
      ...d,
      // Keep top-level score/percentile/valid as current phase for backwards compat
      score: d2?.score ?? d.score,
      percentile: d2?.percentile ?? d.percentile,
      valid: d2?.valid ?? d.valid,
      phase1: hasComparison && d1 ? { score: d1.score, percentile: d1.percentile } : null,
      phase2: hasComparison && d2 ? { score: d2.score, percentile: d2.percentile } : null,
    };
  });
  // Merge phase 1 NB data from the phase 1 assessment record for comparison
  const mergedResultsData = (assessment?.assessment_type === "sentinel_phase2" && phase1Assessment)
    ? {
        ...(assessment.results_data || {}),
        neurobehavioral_phase1:
          phase1Assessment.results_data?.neurobehavioral_phase1 ||
          assessment.results_data?.neurobehavioral_phase1 ||
          {},
      }
    : assessment?.results_data;
  const BEHAV_DOMAINS = buildBehavDomains(mergedResultsData, assessment?.assessment_type);

  const nci = NEURO_DOMAINS.find(d => d.key === "nci" || d.key === "neurocognitive_index");
  const impaired = NEURO_DOMAINS.filter(d => d.percentile != null && d.percentile <= 8).length;
  const validCount = NEURO_DOMAINS.filter(d => d.valid === true).length;

  // ─── Data completeness flags ───────────────────────────────────────────────
  // Neurocognitive: flag if CNSVS failed to load OR any of the 12 core domains is missing a score
  // Each entry is [canonical label, ...accepted CNSVS keys]
  const REQUIRED_NEURO_DOMAINS = [
    { label: "Neurocognitive Index",   keys: ["neurocognitive_index", "nci"] },
    { label: "Memory",                 keys: ["memory", "working_memory"] },
    { label: "Verbal Memory",          keys: ["verbal_memory"] },
    { label: "Visual Memory",          keys: ["visual_memory"] },
    { label: "Psychomotor Speed",      keys: ["psychomotor_speed"] },
    { label: "Reaction Time",          keys: ["reaction_time"] },
    { label: "Complex Attention",      keys: ["complex_attention"] },
    { label: "Cognitive Flexibility",  keys: ["cognitive_flexibility"] },
    { label: "Processing Speed",       keys: ["processing_speed"] },
    { label: "Executive Functioning",  keys: ["executive_functioning", "executive_function"] },
    { label: "Sustained Attention",    keys: ["sustained_attention", "simple_attention"] },
  ];
  const missingNeuroDomains = isSentinelAssessment && !cnsvsLoading
    ? REQUIRED_NEURO_DOMAINS.filter(({ keys }) =>
        !NEURO_DOMAINS.find(d => keys.includes(d.key) && d.score != null)
      ).map(({ label }) => label)
    : [];
  const neurocognitiveMissing = isSentinelAssessment && !cnsvsLoading && (!cnsvsPhaseData || missingNeuroDomains.length > 0);

  // Neurobehavioral: flag if ANY metric is null (partial or full missing)
  const allBehavMetrics = BEHAV_DOMAINS.flatMap(s => s.metrics);
  const missingBehavMetrics = allBehavMetrics.filter(m => m.score == null).map(m => m.label);
  const neurobehavioralMissing = isSentinelAssessment && !behavioralLoading && missingBehavMetrics.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-0 max-w-5xl">
      {/* Patient Lookup */}
      <div className="mb-6 bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
        <p className="text-slate-300 text-xs font-semibold mb-2.5">FIND & LOAD PATIENT</p>
        <PatientLookup onPatientSelect={handlePatientSelect} />
        {assessment && (() => {
          const testNotCompleted = assessment.status !== "completed";
          const pendingApproval = !isValhalla && !assessment.approved_at;
          const isDisabled = downloadingPdf || cnsvsLoading || behavioralLoading || testNotCompleted || pendingApproval;

          let label = "Download as PDF";
          if (downloadingPdf) label = "Generating PDF…";
          else if (cnsvsLoading || behavioralLoading) label = "Loading data…";
          else if (testNotCompleted) label = "Test Not Completed";
          else if (pendingApproval) label = "Pending Valhalla Approval";

          let title = undefined;
          if (testNotCompleted) title = "The patient has not completed this assessment yet.";
          else if (pendingApproval) title = "This report must be approved by Valhalla staff before it can be downloaded.";

          return (
            <Button
              onClick={handleDownloadPdf}
              disabled={isDisabled}
              title={title}
              className="mt-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold gap-2"
            >
              <Download className="w-4 h-4" />
              {label}
            </Button>
          );
        })()}
      </div>

      {/* Report / CogniTrackX / Invoice toggle */}
      {assessment && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {/* Report tab: only for sentinel assessments */}
          {isSentinel(assessment.assessment_type) && (
            <button
              onClick={() => setActiveView("report")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "report" ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/40"}`}
            >
              <FileText className="w-4 h-4" /> Report
            </button>
          )}
          {assessment.assessment_type === "cognitrackx" && (
            <button
              onClick={() => setActiveView("cognitrackx")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "cognitrackx" ? "bg-purple-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/40"}`}
            >
              <Activity className="w-4 h-4" /> CogniTrackX Report
            </button>
          )}
          <button
            onClick={() => setActiveView("invoice")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "invoice" ? "bg-green-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/40"}`}
          >
            <Receipt className="w-4 h-4" /> Invoice
          </button>
        </div>
      )}

      {/* CogniTrackX Report view */}
      {activeView === "cognitrackx" && assessment && (
        <div data-pdf-content className="space-y-6 mb-8">
          {/* Approval section for CogniTrackX */}
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-lg mb-1">CogniTrackX Report Status</h3>
              <p className="text-slate-400 text-sm">This report requires Valhalla Health Staff approval before firm users can access it.</p>
              </div>
              {isValhalla && assessment && (
                assessment?.approved_at ? (
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <div className="text-right">
                      <p className="text-green-300 text-sm font-semibold">Approved by Valhalla Health Staff</p>
                      <p className="text-green-400/70 text-xs">{format(new Date(assessment.approved_at), "MM/dd/yyyy")}</p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleApprove}
                    disabled={approving}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {approving ? "Approving…" : "Approve Report"}
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Block access if not approved and user is not Valhalla */}
          {!isValhalla && !assessment?.approved_at ? (
            <div className="flex items-center justify-center py-20">
              <div className="max-w-md w-full bg-slate-800/60 border border-amber-500/30 rounded-2xl p-10 text-center">
                <CheckCircle2 className="w-14 h-14 text-amber-400 mx-auto mb-4" />
                <h2 className="text-white text-xl font-bold mb-2">Pending Valhalla Review</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  This CogniTrackX report is currently under review by Valhalla clinical staff. It will become available once approved.
                </p>
                <p className="text-slate-500 text-xs mt-4">Please check back shortly or contact Valhalla Health.</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-xl p-6">
              <CogniTrackXReport
                data={cognitrackxData || assessment?.results_data?.cognitrackx}
                patientName={patientFirstLast}
                loading={cognitrackxLoading}
              />
            </div>
          )}
        </div>
      )}

      {/* Invoice view */}
      {activeView === "invoice" && assessment && (
        <div data-pdf-content className="rounded-xl overflow-hidden shadow-2xl mb-8">
          <BillingInvoice
            assessment={assessment}
            patientName={patientFirstLast}
          />
        </div>
      )}

      {/* Non-Valhalla users: block report view if not approved */}
      {activeView === "report" && !isValhalla && assessment && !assessment.approved_at && (
        <div className="flex items-center justify-center py-20">
          <div className="max-w-md w-full bg-slate-800/60 border border-amber-500/30 rounded-2xl p-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-amber-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">Pending Valhalla Review</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              This report is currently under review by Valhalla clinical staff. It will become available once it has been approved and signed.
            </p>
            <p className="text-slate-500 text-xs mt-4">Please check back shortly or contact Valhalla Health.</p>
          </div>
        </div>
      )}

      {/* Portal header - always visible */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(backUrl)} className="text-slate-400 hover:text-white -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400" />
                <h1 className="text-xl font-bold text-white">Full Patient Report</h1>
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-400">
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{patientFirstLast}</span>
                {assessment?.patient_id && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">ID: {assessment.patient_id}</span>
                )}
                {assessedDate && (
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Assessed: {format(new Date(assessedDate), "MM/dd/yyyy")}</span>
                )}
                {assessment && (
                  <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs">{currentPhaseLabel}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* PDF Download */}
            {assessment && (() => {
              const testNotCompleted = assessment.status !== "completed";
              const pendingApproval = !isValhalla && !assessment.approved_at;
              const isDisabled = downloadingPdf || cnsvsLoading || behavioralLoading || testNotCompleted || pendingApproval;

              let label = "Download PDF";
              if (downloadingPdf) label = "Generating…";
              else if (cnsvsLoading || behavioralLoading) label = "Loading…";
              else if (testNotCompleted) label = "Not Completed";
              else if (pendingApproval) label = "Pending Approval";

              let title = undefined;
              if (testNotCompleted) title = "The patient has not completed this assessment yet.";
              else if (pendingApproval) title = "This report must be approved by Valhalla staff before it can be downloaded.";

              return (
                <Button
                  onClick={handleDownloadPdf}
                  disabled={isDisabled}
                  title={title}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold gap-2"
                >
                  <Download className="w-4 h-4" />
                  {label}
                </Button>
              );
            })()}

            {/* Approve button — Valhalla staff only */}
            {isValhalla && assessment && (
              assessment?.approved_at ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <div>
                    <p className="text-green-300 text-xs font-semibold">Approved</p>
                    <p className="text-green-400/70 text-xs">{format(new Date(assessment.approved_at), "MM/dd/yyyy")}</p>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleApprove}
                  disabled={approving}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {approving ? "Approving…" : "Approve & Sign"}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Assessment tabs — only show when patient has multiple assessments */}
        {allPatientAssessments.length > 1 && (
          <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3">
            <p className="text-slate-400 text-xs font-semibold mb-2">SWITCH ASSESSMENT REPORT</p>
            <Tabs value={activeAssessmentId || ""} onValueChange={handleTabChange}>
              <TabsList className="bg-slate-700/50 flex-wrap h-auto gap-1">
                {allPatientAssessments.map(pa => (
                  <TabsTrigger
                    key={pa.id}
                    value={pa.id}
                    className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
                  >
                    {getPhaseLabel(pa.assessment_type)}
                    {pa.status && (
                      <span className={`ml-1.5 text-[9px] px-1 rounded ${pa.status === "completed" ? "bg-green-500/30 text-green-300" : "bg-slate-600 text-slate-400"}`}>
                        {pa.status}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      <div data-pdf-content style={{ display: (activeView === "invoice" || activeView === "cognitrackx") ? "none" : (activeView === "report" && !isValhalla && assessment && !assessment.approved_at) ? "none" : undefined }}>

      {/* ── COVER ──────────────────────────────────────────────────────────── */}
      <Section id="cover">
        <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
          <img
            src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80"
            alt="mountains"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-800/90 via-slate-700/70 to-transparent" />
          <div className="absolute left-0 top-0 bottom-0 w-3 bg-amber-400" />
          <div className="relative z-10 p-10 flex flex-col justify-between h-full" style={{ minHeight: 420 }}>
            <div className="flex items-center gap-3">
              <Brain className="w-10 h-10 text-amber-400" />
              <div>
                <p className="text-white font-black text-xl tracking-wide">VALHALLA</p>
                <p className="text-white font-black text-xl tracking-wide leading-none">HEALTH</p>
              </div>
            </div>
            <div className="mt-auto">
              <p className="text-white text-4xl font-light tracking-widest mb-1">{patientDisplay}</p>
              <p className="text-slate-300 text-sm font-semibold tracking-[0.3em]">{currentPhaseLabel}</p>
            </div>
            <div className="flex items-end justify-between mt-8">
              <p className="text-amber-400 text-sm font-medium tracking-widest underline underline-offset-4">valhallaplus.org</p>
              <div className="bg-amber-400 text-slate-900 font-black text-5xl px-4 py-3 leading-none">{new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── VALHALLA INFO ──────────────────────────────────────────────────── */}
      <Section id="info">
        <SectionBanner gradient="bg-gradient-to-r from-slate-700 to-slate-800" title="Valhalla Health Information" />
        <div className="px-8 py-8 space-y-6">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699ccd37c7d67b6c73c5a502/513b48594_Screenshot2026-02-23at92700PM.png"
            alt="Brain MRI imaging"
            className="w-full h-48 object-cover rounded-xl"
          />
          <h3 className="text-xl font-black text-amber-600">Leaders in TBI Assessment, Treatment, and Recovery</h3>
          <div className="flex gap-4 items-start">
            <Brain className="w-12 h-12 text-amber-400 shrink-0 mt-1" />
            <p className="text-slate-700 text-sm leading-relaxed">
              At Valhalla Cell Health, we specialize in the precise evaluation and treatment of Traumatic Brain Injury (TBI) and concussion-related impairments. Our expertise in neurology, rehabilitation, and clinical assessment allows us to deliver data-driven, medically validated care that supports both patient recovery and the objective documentation necessary for legal and medical proceedings.
            </p>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">
            We utilize advanced, evidence-based methodologies to measure neurological, cognitive, and physiological function, ensuring that every aspect of a patient's condition is thoroughly assessed, tracked, and treated.
          </p>
          <hr className="border-slate-200" />
          <h4 className="text-amber-600 font-bold text-sm">Cutting-Edge Medical Solutions</h4>
          <div className="space-y-3">
            {[
              ["Photobiomodulation Therapy", "Facilitates neurological repair by modulating cellular metabolism, reducing neuroinflammation, and promoting tissue recovery."],
              ["Targeted Laser Therapies", "Precisely addresses myofascial pain, reduces post-concussive headache frequency and severity, enhances circulation, and mitigates neuroinflammatory responses."],
              ["Neuroplasticity-Driven Rehabilitation", "Enhances cognitive function, motor control, and sensory integration through structured, data-backed protocols tailored to individual neurological profiles."],
              ["Quantitative Neurological & Functional Assessments", "Employs objective metrics to evaluate brain function, cognitive processing speed, vestibular integrity, and physiological responses."],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-2 text-sm text-slate-700">
                <span className="text-amber-500 font-bold shrink-0">✔</span>
                <p><strong>{title}</strong> – {desc}</p>
              </div>
            ))}
          </div>
          <hr className="border-slate-200" />
          <h3 className="text-xl font-black text-amber-600">Experts in TBI, Rehabilitation & Case Documentation</h3>
          <div className="space-y-3">
            {[
              ["Objective, medically validated assessments", "that document functional impairments and recovery progress."],
              ["Comprehensive tracking", "of cognitive, vestibular, and neurological function to inform treatment plans and case evaluations."],
              ["Expert interpretation of clinical data", "that aligns with both medical and legal standards."],
            ].map(([bold, rest]) => (
              <div key={bold} className="flex gap-2 text-sm text-slate-700">
                <span className="text-amber-500 font-bold shrink-0">✔</span>
                <p><strong>{bold}</strong> {rest}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
            <h4 className="font-bold text-amber-700">Clinical Validation & Scientific Backing</h4>
            <p className="text-slate-700 text-sm leading-relaxed">
              Emerging research from top medical and academic institutions shows Photobiomodulation Therapy (PBM) is effective in TBI treatment. Peer-reviewed studies demonstrate PBM's ability to support neuroplasticity, reduce neuroinflammation, and improve cognitive and functional recovery.
            </p>
          </div>
          <h4 className="font-black text-slate-800 text-sm">Why Valhalla Cell Health?</h4>
          {["Medically Driven, Data-Backed, and Results-Oriented","Advanced Clinical Assessments & Treatment Solutions","A Trusted Partner for Patients, Physicians, and Attorneys"].map(s => (
            <div key={s} className="flex gap-2 text-sm text-slate-700"><span className="text-amber-500">✔</span><p>{s}</p></div>
          ))}
        </div>
      </Section>

      {/* ── TBI MEASUREMENT OVERVIEW ───────────────────────────────────────── */}
      <Section id="tbi-overview">
        <SectionBanner gradient="bg-gradient-to-r from-slate-700 to-slate-900" title="TBI: Objective Measurement" />
        <div className="px-8 py-8 space-y-6">
          <p className="text-slate-700 text-sm leading-relaxed">
            At Valhalla Health, we specialize in the precise assessment of traumatic brain injuries (TBI) by employing a data-driven approach to track impairments, monitor recovery, and provide input for treatment decisions. Effective TBI management relies on objective, quantifiable data rather than subjective reporting alone.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-bold text-amber-600">Adaptive Neurocognitive Computerized Testing</h4>
              {[["Purpose","Evaluates cognitive function, including memory, attention, processing speed, and executive function."],["Methodology","Uses computerized neurocognitive assessments to measure performance and track changes over time."],["Impact","Establishes baseline function and provides objective tracking of neurological recovery."]].map(([k,v]) => (
                <p key={k} className="text-sm text-slate-700"><strong>{k}:</strong> {v}</p>
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="font-bold text-amber-600">Neurobehavioral & Subjective Symptom Assessment</h4>
              <p className="text-sm text-slate-700"><strong>Purpose:</strong> Evaluates the neurobehavioral impact of TBI, including emotional, cognitive, and physical symptoms.</p>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 ml-2">
                <li><strong>Mood:</strong> Anxiety, depression, and emotional regulation.</li>
                <li><strong>Sleep:</strong> Insomnia, hypersomnia, and sleep disturbances.</li>
                <li><strong>Pain & Fatigue:</strong> Chronic headaches, musculoskeletal pain, and post-concussive fatigue.</li>
                <li><strong>Quality of Life (QoL):</strong> Functional limitations affecting daily activities.</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ── NEUROCOGNITIVE TESTING — only for Sentinel Phase 1 & 2 ───────── */}
      {isSentinelAssessment && (
        <Section id="neurocognitive">
          <SectionBanner gradient="bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600" title="Baseline Neurocognitive Testing" subtitle="Adaptive Neurocognitive Computerized Assessment — CNS Vital Signs" />
          <div className="grid grid-cols-3 gap-4 px-8 py-5 bg-slate-50 border-b border-slate-200">
            {[
              { label: "NCI Score", value: nci?.score ?? "—", sub: nci?.percentile != null ? `${nci.percentile}th %` : "—", grad: "from-cyan-500 to-teal-600" },
              { label: "Impaired Domains", value: NEURO_DOMAINS.length ? impaired : "—", sub: NEURO_DOMAINS.length ? `of ${NEURO_DOMAINS.length} domains ≤ 8th %` : "No data", grad: "from-rose-500 to-red-600" },
              { label: "Valid Measures", value: NEURO_DOMAINS.length ? validCount : "—", sub: NEURO_DOMAINS.length ? `of ${NEURO_DOMAINS.length} passed validity` : "No data", grad: "from-emerald-500 to-teal-600" },
            ].map(c => (
              <div key={c.label} className={`rounded-xl p-4 bg-gradient-to-br ${c.grad} text-white`}>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">{c.label}</p>
                <p className="text-3xl font-black">{c.value}</p>
                <p className="text-white/80 text-xs">{c.sub}</p>
              </div>
            ))}
          </div>
          <div className="px-8 py-6">
            {cnsvsLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                Loading CNSVS data…
              </div>
            )}

            {cnsvsPhaseData?.test_date_start && <p className="text-amber-600 font-semibold italic text-sm mb-4">Assessed on: {new Date(cnsvsPhaseData.test_date_start).toLocaleDateString("en-US")}</p>}
            {hasComparison && (
              <div className="flex items-center gap-5 mb-4 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phase Key:</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-3 rounded-full bg-slate-400 opacity-40 border border-white shadow inline-block" />
                  Phase 1 (baseline)
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-3 rounded-full bg-cyan-500 border-2 border-white shadow-lg inline-block" />
                  Phase 2 (current)
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">↑ Improvement</span>
                <span className="flex items-center gap-1 text-xs font-bold text-red-500">↓ Decline</span>
              </div>
            )}
            <div className="flex items-center gap-4 px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <div className="w-44 shrink-0">Domain</div>
              {hasComparison ? (
                <>
                  <div className="w-16 shrink-0 text-center">Ph.1<br /><span className="text-[9px] font-normal normal-case text-slate-300">Std Score</span></div>
                  <div className="w-12 shrink-0 text-center">Δ</div>
                  <div className="w-16 shrink-0 text-center">Ph.2<br /><span className="text-[9px] font-normal normal-case text-slate-300">Std Score</span></div>
                </>
              ) : (
                <>
                  <div className="w-16 shrink-0 text-center">Std Score</div>
                  <div className="w-20 shrink-0 text-center">Percentile</div>
                </>
              )}
              <div className="w-14 shrink-0 text-center">Valid</div>
              <div className="flex-1">Performance Range</div>
              <div className="w-20 shrink-0 text-right">Classification</div>
            </div>
            <div className="space-y-1.5">
              {NEURO_DOMAINS.map((d, i) => <DomainRow key={i} domain={d} index={i} />)}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide mr-1">Key:</span>
              {[
                { label: "Very Low", color: "bg-red-500", range: "≤2nd %" },
                { label: "Low", color: "bg-orange-500", range: "3–8th %" },
                { label: "Low Average", color: "bg-yellow-500", range: "9–24th %" },
                { label: "Average", color: "bg-green-500", range: "25–74th %" },
                { label: "Above Average", color: "bg-emerald-500", range: "≥75th %" },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${r.color}`} />
                  <span className="font-medium">{r.label}</span>
                  <span className="text-slate-400">({r.range})</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 italic mt-4">
              * Standard scores are based on age-normed comparisons. Scores &lt;85 (16th percentile) may indicate cognitive impairment in the assessed domain.
            </p>
          </div>
        </Section>
      )}

      {/* ── NEUROBEHAVIORAL TESTING — only for Sentinel Phase 1 & 2 ──────── */}
      {isSentinelAssessment && (
        <Section id="neurobehavioral">
          <SectionBanner gradient="bg-gradient-to-r from-violet-600 to-purple-700" title="Neurobehavioral Testing" subtitle="Subjective Symptom Assessment — Patient-Reported Outcomes" />
          <div className="px-8 py-6 space-y-4">
            {(() => {
              const timepoint = assessment?.assessment_type === "sentinel_phase2" ? "phase2" : "phase1";
              const submissionDate = assessment?.results_data?.[`neurobehavioral_${timepoint}`]?.submission_date;
              let displayDate = null;
              if (submissionDate) {
                const num = Number(submissionDate);
                if (!isNaN(num) && num > 1000) {
                  const jsDate = new Date((num - 25569) * 86400 * 1000);
                  if (!isNaN(jsDate.getTime())) displayDate = jsDate;
                } else {
                  const parsed = new Date(submissionDate);
                  if (!isNaN(parsed.getTime())) displayDate = parsed;
                }
              }
              if (!displayDate && assessedDate) {
                const parsed = new Date(assessedDate);
                if (!isNaN(parsed.getTime())) displayDate = parsed;
              }
              return displayDate ? (
                <p className="text-amber-600 font-semibold italic text-sm">Assessed on: {format(displayDate, "MM/dd/yyyy")}</p>
              ) : null;
            })()}
            {/* Phase comparison legend — only for phase 2 when phase 1 data exists */}
            {(() => {
              const nb1 = mergedResultsData?.["neurobehavioral_phase1"] || {};
              const hasBehavP1 = Object.keys(nb1).length > 0 && isPhase2;
              return hasBehavP1 ? (
                <div className="flex items-center gap-5 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phase Key:</span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="inline-block w-5 h-2 rounded bg-slate-300" />
                    Phase 1 (baseline)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="inline-block w-5 h-2 rounded bg-cyan-400" />
                    Phase 2 (current)
                  </span>
                  <span className="text-xs font-bold text-emerald-600">↓ lower = improvement (most measures)</span>
                </div>
              ) : null;
            })()}
            {behavioralLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                Loading neurobehavioral data…
              </div>
            )}
            {neurobehavioralMissing && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3">
                <span className="text-red-400 text-lg leading-none">⚠</span>
                <div>
                  <p className="text-red-300 font-semibold text-sm">Neurobehavioral Data Incomplete</p>
                  <p className="text-red-400/80 text-xs mt-0.5">Missing scores for: {missingBehavMetrics.join(", ")}.</p>
                </div>
              </div>
            )}
            <BehavSection category={BEHAV_DOMAINS[0].category} metrics={BEHAV_DOMAINS[0].metrics} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BehavSection category={BEHAV_DOMAINS[1].category} metrics={BEHAV_DOMAINS[1].metrics} />
              <BehavSection category={BEHAV_DOMAINS[2].category} metrics={BEHAV_DOMAINS[2].metrics} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BehavSection category={BEHAV_DOMAINS[3].category} metrics={BEHAV_DOMAINS[3].metrics} />
              <BehavSection category={BEHAV_DOMAINS[4].category} metrics={BEHAV_DOMAINS[4].metrics} />
            </div>
            <BehavSection category={BEHAV_DOMAINS[5].category} metrics={BEHAV_DOMAINS[5].metrics} />
            <hr className="border-slate-200 mt-2" />
            <div className="space-y-3">
              <h3 className="font-bold text-amber-600">Neurobehavioral & Subjective Symptom Assessment</h3>
              <p className="text-sm text-slate-700"><strong>Purpose:</strong> Evaluates the neurobehavioral impact of TBI, including emotional, cognitive, and physical symptoms.</p>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 ml-2">
                <li><strong>Mood:</strong> Anxiety, depression, and emotional regulation.</li>
                <li><strong>Sleep:</strong> Insomnia, hypersomnia, and sleep disturbances.</li>
                <li><strong>Pain & Fatigue:</strong> Chronic headaches, musculoskeletal pain, and post-concussive fatigue.</li>
                <li><strong>Quality of Life (QoL):</strong> Functional limitations affecting daily activities.</li>
              </ul>
              <p className="text-sm text-slate-700"><strong>Impact:</strong> Provides a structured framework for tracking symptom progression and ensuring a comprehensive understanding of patient-reported concerns.</p>
            </div>
          </div>
        </Section>
      )}

      {/* ── TREATMENT RECOMMENDATIONS ──────────────────────────────────────── */}
      <Section id="treatment">
        <SectionBanner gradient="bg-gradient-to-r from-amber-500 to-orange-600" title="Treatment Recommendations" />
        <div className="px-8 py-8 space-y-5">
          {RECOMMENDATIONS.map(rec => (
            <div key={rec.num}>
              <h4 className="font-bold text-amber-600 text-sm mb-1.5">{rec.num}. {rec.title}</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {rec.items.map((item, i) => (
                  <li key={i} className="text-slate-700 text-sm">{item}</li>
                ))}
              </ul>
            </div>
          ))}
          <hr className="border-slate-200 mt-6" />
          <div className="space-y-2 mt-6">
            <p style={{ fontFamily: "'Dancing Script', cursive", fontSize: "2.5rem", lineHeight: 1.1 }} className="text-slate-800">David Tate</p>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');`}</style>
            <div className="w-48 border-b border-slate-400 mb-1" />
            <p className="text-slate-700 text-sm font-bold">Dr. David Tate</p>
            <p className="text-slate-600 text-sm">Valhalla Health</p>
            <div className="flex gap-8 mt-2">
              <p className="text-slate-700 text-sm">
                <strong>Date Signed:</strong>{" "}
                {assessment?.approved_at
                  ? format(new Date(assessment.approved_at), "MM/dd/yyyy")
                  : <span className="text-slate-400 italic">Pending approval</span>}
              </p>
              <div className="text-slate-700 text-sm flex items-center gap-2 flex-wrap">
                <strong>Date Evaluated:</strong>{" "}
                {editingEvalDate ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={evalDateInput}
                      onChange={e => setEvalDateInput(e.target.value)}
                      className="border border-slate-300 rounded px-2 py-0.5 text-sm text-slate-700"
                    />
                    <button onClick={handleSaveEvalDate} disabled={savingEvalDate} className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded hover:bg-amber-400">
                      {savingEvalDate ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingEvalDate(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                  </span>
                ) : evaluatedDate ? (
                  <span className="flex items-center gap-1.5">
                    {format(new Date(evaluatedDate.includes('T') ? evaluatedDate : evaluatedDate + 'T12:00:00'), "MM/dd/yyyy")}
                    {isValhalla && (
                      <button onClick={() => setEditingEvalDate(true)} className="text-xs text-slate-400 hover:text-amber-600 underline underline-offset-2">edit</button>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400 italic">
                    Not set
                    {isValhalla && (
                      <button onClick={() => setEditingEvalDate(true)} className="text-xs text-amber-600 hover:text-amber-500 underline underline-offset-2 not-italic">Set date</button>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CONTACT ────────────────────────────────────────────────────────── */}
      <Section id="contact">
        <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
          <img
            src="https://images.unsplash.com/photo-1518821226-7e3c3df22d29?w=1200&q=80"
            alt="therapy"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-slate-800/80" />
          <div className="relative z-10 px-8 py-8">
            <h2 className="text-2xl font-black text-amber-400 mb-2">More Information about TBI Care</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <p className="text-slate-300 text-sm leading-relaxed">
                For inquiries about our innovative therapies or to refer a client to Valhalla Cell Health, our team is here to provide the information, resources, and guidance you need. We are committed to ensuring every client receives the highest level of care and support tailored to their unique needs.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Phone, label: "(435) 447-4354" },
                  { icon: MapPin, label: "170 S. 1200 E. Suite 350, Lehi, UT 84043" },
                  { icon: Mail, label: "info@valhallahealth.org" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-400 rounded flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-900" />
                    </div>
                    <p className="text-slate-200 text-sm">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-8 py-6 bg-white space-y-3">
          <h3 className="text-amber-600 font-black text-xl">Thank you!</h3>
          <p className="text-slate-700 text-sm leading-relaxed">
            Your trust in our expertise and care not only helps us deliver exceptional treatment but also reinforces the commitment we share to improve the lives of those navigating the challenges of traumatic brain injuries and other complex conditions. Together, we are building a bridge to recovery—one that prioritizes compassion, evidence-based care, and measurable results.
          </p>
          <p className="text-xs text-slate-500 italic">
            Note: For more information about the research quoted above please refer to the Track TBI — "Transforming Research and Clinical Knowledge in TBI"
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-600">VALHALLA CELL HEALTH</span>
            <span>·</span>
            <span>PATIENT REPORT {new Date().getFullYear()}</span>
          </div>
        </div>
      </Section>
      </div>
    </div>
  );
}