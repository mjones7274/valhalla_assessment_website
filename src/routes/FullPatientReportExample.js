import React from "react";
import {
  FaBrain,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaClipboardList,
  FaEnvelope,
  FaMapMarkerAlt,
  FaPhone,
  FaReceipt,
} from "react-icons/fa";

const reportShellStyle = {
  minHeight: "100%",
  background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
  color: "#0f172a",
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe5f4",
  borderRadius: "20px",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
};

const sectionStyle = {
  ...cardStyle,
  overflow: "hidden",
  marginBottom: "22px",
};

const bannerBaseStyle = {
  padding: "24px 28px",
  color: "#ffffff",
};

const placeholderReport = {
  patient: {
    name: "Jordan Walker",
    patientId: "PT-10482",
    phase: "FULL REPORT",
    evaluationDate: "April 23, 2026",
    location: "Phoenix, Arizona",
    phone: "(602) 555-0144",
    email: "jordan.walker@example.com",
  },
  summary: [
    { label: "NCI", score: 84, percentile: 72, range: "Average", tone: "#06b6d4" },
    { label: "Memory", score: 91, percentile: 81, range: "Above Average", tone: "#2563eb" },
    { label: "Processing Speed", score: 74, percentile: 39, range: "Low Average", tone: "#14b8a6" },
    { label: "Executive Function", score: 78, percentile: 46, range: "Average", tone: "#4f46e5" },
  ],
  neuroDomains: [
    { label: "Neurocognitive Index", score: 84, percentile: 72, valid: true, category: "Index" },
    { label: "Verbal Memory", score: 88, percentile: 79, valid: true, category: "Memory" },
    { label: "Visual Memory", score: 93, percentile: 84, valid: true, category: "Memory" },
    { label: "Reaction Time", score: 73, percentile: 36, valid: true, category: "Speed" },
    { label: "Complex Attention", score: 77, percentile: 44, valid: true, category: "Attention" },
    { label: "Cognitive Flexibility", score: 80, percentile: 51, valid: true, category: "Executive" },
  ],
  behaviorSections: [
    {
      title: "Sleep + Recovery",
      items: [
        { label: "Fatigue", score: 58, note: "Mild elevation" },
        { label: "Sleep Disturbance", score: 61, note: "Needs monitoring" },
      ],
    },
    {
      title: "Pain + Neurologic",
      items: [
        { label: "Pain Interference", score: 54, note: "Within expected range" },
        { label: "Headache Impact", score: 66, note: "Moderate impact" },
      ],
    },
    {
      title: "Mood + Regulation",
      items: [
        { label: "Anxiety", score: 57, note: "Situational symptoms" },
        { label: "Depression", score: 51, note: "Minimal presentation" },
      ],
    },
  ],
  recommendations: [
    {
      title: "Cognitive Rehabilitation",
      items: [
        "Initiate targeted exercises for attention, pacing, and working memory.",
        "Use structured compensatory strategies for high-demand tasks.",
      ],
    },
    {
      title: "Sleep Optimization",
      items: [
        "Stabilize sleep and wake times with consistent evening routines.",
        "Review hydration, caffeine timing, and pre-sleep screen exposure.",
      ],
    },
    {
      title: "Follow-Up Monitoring",
      items: [
        "Repeat symptom and neurocognitive screening after treatment progression.",
        "Coordinate recommendations across rehab and behavioral health providers.",
      ],
    },
  ],
};

function MetricPill({ label, value }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.16)",
        border: "1px solid rgba(255,255,255,0.22)",
        fontSize: "0.85rem",
      }}
    >
      <span style={{ opacity: 0.78 }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryCard({ item }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: "18px 18px 16px",
        minWidth: "180px",
        flex: "1 1 180px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 700 }}>{item.label}</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, marginTop: "8px" }}>{item.score}</div>
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: "999px",
            background: `${item.tone}18`,
            color: item.tone,
            fontSize: "0.72rem",
            fontWeight: 800,
          }}
        >
          {item.range}
        </div>
      </div>
      <div style={{ marginTop: "10px", color: "#475569", fontSize: "0.9rem" }}>
        Percentile <strong>{item.percentile}%</strong>
      </div>
      <div style={{ marginTop: "12px", height: "8px", borderRadius: "999px", background: "#e2e8f0" }}>
        <div
          style={{
            width: `${Math.max(8, Math.min(item.percentile, 100))}%`,
            height: "100%",
            borderRadius: "999px",
            background: item.tone,
          }}
        />
      </div>
    </div>
  );
}

function DomainRow({ item, index }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2.2fr 0.8fr 0.9fr 0.8fr 1fr",
        gap: "12px",
        alignItems: "center",
        padding: "14px 18px",
        background: index % 2 === 0 ? "#ffffff" : "#f8fafc",
        borderTop: index === 0 ? "none" : "1px solid #e2e8f0",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
        <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "3px" }}>{item.category}</div>
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>{item.score}</div>
      <div style={{ color: "#0f766e", fontWeight: 700 }}>{item.percentile}%</div>
      <div style={{ color: item.valid ? "#059669" : "#94a3b8", fontWeight: 700 }}>
        {item.valid ? "Yes" : "No"}
      </div>
      <div style={{ fontWeight: 700, color: "#475569" }}>{item.category}</div>
    </div>
  );
}

function BehaviorCard({ section }) {
  return (
    <div style={{ ...cardStyle, overflow: "hidden", flex: "1 1 280px" }}>
      <div
        style={{
          padding: "12px 16px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: "0.8rem",
          letterSpacing: "0.08em",
          color: "#64748b",
          fontWeight: 800,
          textTransform: "uppercase",
        }}
      >
        {section.title}
      </div>
      <div style={{ padding: "14px 16px" }}>
        {section.items.map((item, index) => (
          <div
            key={`${section.title}-${item.label}`}
            style={{
              paddingBottom: index === section.items.length - 1 ? 0 : "12px",
              marginBottom: index === section.items.length - 1 ? 0 : "12px",
              borderBottom: index === section.items.length - 1 ? "none" : "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "4px" }}>{item.note}</div>
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>{item.score}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ item, index }) {
  return (
    <div style={{ ...cardStyle, padding: "18px 18px 16px" }}>
      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "999px",
            background: "#dbeafe",
            color: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>
        <div>
          <div style={{ fontWeight: 800, marginBottom: "10px" }}>{item.title}</div>
          {item.items.map((entry) => (
            <div key={entry} style={{ display: "flex", gap: "10px", marginBottom: "8px", color: "#334155" }}>
              <FaCheckCircle style={{ color: "#2563eb", marginTop: "3px", flexShrink: 0 }} />
              <span>{entry}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FullPatientReportExample({ assessmentName = "Assessment" }) {
  const reportTitle = `${assessmentName} Example Report`;

  return (
    <div style={reportShellStyle}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "26px 28px 34px" }}>
        <div
          style={{
            ...cardStyle,
            background: "linear-gradient(135deg, #0f172a 0%, #164e63 48%, #1d4ed8 100%)",
            color: "#ffffff",
            padding: "28px 30px",
            marginBottom: "22px",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ maxWidth: "720px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <FaBrain />
                <span style={{ letterSpacing: "0.12em", fontWeight: 800, fontSize: "0.78rem" }}>
                  FULL PATIENT REPORT PREVIEW
                </span>
              </div>
              <h1 style={{ fontSize: "2.25rem", lineHeight: 1.1, margin: 0, fontWeight: 900 }}>{reportTitle}</h1>
              <p style={{ margin: "14px 0 0", color: "rgba(255,255,255,0.82)", fontSize: "1rem" }}>
                Placeholder report content for the separate Full Patient Report example component.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
              <MetricPill label="Patient" value={placeholderReport.patient.patientId} />
              <MetricPill label="Phase" value={placeholderReport.patient.phase} />
              <MetricPill label="Status" value="Example" />
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: "22px 24px", marginBottom: "22px" }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 280px" }}>
              <div style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 800, letterSpacing: "0.06em" }}>
                PATIENT OVERVIEW
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 900, marginTop: "8px" }}>{placeholderReport.patient.name}</div>
              <div style={{ marginTop: "10px", color: "#475569", lineHeight: 1.7 }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><FaCalendarAlt />{placeholderReport.patient.evaluationDate}</div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><FaMapMarkerAlt />{placeholderReport.patient.location}</div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><FaPhone />{placeholderReport.patient.phone}</div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><FaEnvelope />{placeholderReport.patient.email}</div>
              </div>
            </div>
            <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ ...cardStyle, padding: "16px 18px", background: "#f8fafc" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "#1d4ed8", fontWeight: 800 }}>
                  <FaClipboardList /> Clinical Summary
                </div>
                <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.6 }}>
                  Placeholder narrative summarizing cognitive performance, symptom burden, and treatment direction.
                </p>
              </div>
              <div style={{ ...cardStyle, padding: "16px 18px", background: "#f8fafc" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "#0f766e", fontWeight: 800 }}>
                  <FaReceipt /> Referral Status
                </div>
                <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.6 }}>
                  Separate full report example component retained for future use.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "22px" }}>
          {placeholderReport.summary.map((item) => (
            <SummaryCard key={item.label} item={item} />
          ))}
        </div>

        <div style={sectionStyle}>
          <div style={{ ...bannerBaseStyle, background: "linear-gradient(90deg, #0f766e 0%, #0891b2 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <FaChartLine />
              <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900 }}>Neurocognitive Performance</h2>
            </div>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.84)" }}>
              Example cognition panel styled from the original Base44 report.
            </p>
          </div>
          <div style={{ padding: "0" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 0.8fr 0.9fr 0.8fr 1fr",
                gap: "12px",
                padding: "14px 18px",
                background: "#f8fafc",
                color: "#64748b",
                fontSize: "0.78rem",
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              <div>Domain</div>
              <div>Score</div>
              <div>Percentile</div>
              <div>Valid</div>
              <div>Category</div>
            </div>
            {placeholderReport.neuroDomains.map((item, index) => (
              <DomainRow key={item.label} item={item} index={index} />
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ ...bannerBaseStyle, background: "linear-gradient(90deg, #312e81 0%, #4f46e5 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <FaBrain />
              <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900 }}>Neurobehavioral Findings</h2>
            </div>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.84)" }}>
              Placeholder symptom scales and behavioral indicators.
            </p>
          </div>
          <div style={{ padding: "18px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {placeholderReport.behaviorSections.map((section) => (
              <BehaviorCard key={section.title} section={section} />
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ ...bannerBaseStyle, background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <FaClipboardList />
              <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900 }}>Treatment Recommendations</h2>
            </div>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.84)" }}>
              Example follow-up planning modeled after the original report structure.
            </p>
          </div>
          <div style={{ padding: "18px", display: "grid", gap: "16px" }}>
            {placeholderReport.recommendations.map((item, index) => (
              <RecommendationCard key={item.title} item={item} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
