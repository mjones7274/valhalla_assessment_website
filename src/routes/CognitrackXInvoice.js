import React from "react";

const formatInvoiceDate = (value) => {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    const today = new Date();
    return `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) return rawValue;

  return `${parsedDate.getDate()}/${parsedDate.getMonth() + 1}/${parsedDate.getFullYear()}`;
};

const invoiceShellStyle = {
  width: "min(100%, 8.5in)",
  minHeight: "11in",
  margin: "0 auto",
  background: "#ffffff",
  color: "#111827",
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  padding: "0.65in",
  boxSizing: "border-box",
};

const sectionLabelStyle = {
  fontWeight: 800,
  fontSize: "0.95rem",
  letterSpacing: "0.01em",
};

const fieldValueStyle = {
  fontSize: "1rem",
  color: "#1f2937",
};

export default function CognitrackXInvoice({
  assessmentName,
  patientName,
  companyName,
  invoiceNumber,
  assessmentDate,
}) {
  const resolvedAssessmentName = String(assessmentName || "").trim() || "COGNITRACKX ASSESSMENT";
  const resolvedPatientName = String(patientName || "").trim() || "—";
  const resolvedCompanyName = String(companyName || "").trim() || "—";
  const resolvedInvoiceNumber = String(invoiceNumber || "").trim() || "—";
  const resolvedAssessmentDate = formatInvoiceDate(assessmentDate);

  return (
    <div style={invoiceShellStyle}>
      <div>
        <div style={{ fontSize: "1.9rem", fontWeight: 900, letterSpacing: "0.01em", lineHeight: 1.1, whiteSpace: "nowrap" }}>
          COGNITRACKX ASSESSMENT INVOICE
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginTop: "22px" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>Valhalla Cell Health</div>
            <div style={{ marginTop: "8px", fontWeight: 700, fontSize: "1rem", lineHeight: 1.45 }}>
              <div>170 S 1200 E  #350</div>
              <div>Lehi, UT 84043</div>
            </div>
          </div>

          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "10px",
              minWidth: "240px",
            }}
          >
            <img
              src="/valhalla-logo.png"
              alt="Valhalla logo"
              style={{
                width: "34px",
                height: "34px",
                display: "block",
              }}
            />
            <div style={{ fontWeight: 900, letterSpacing: "0.28em", fontSize: "1.1rem" }}>VALHALLA</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "28px", display: "flex", justifyContent: "flex-start" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "132px 1fr",
            columnGap: "18px",
            alignItems: "end",
            minWidth: "360px",
          }}
        >
          <div style={{ ...sectionLabelStyle, textAlign: "left" }}>Full Name</div>
          <div style={{ ...fieldValueStyle, textAlign: "left" }}>{resolvedPatientName}</div>
        </div>
      </div>

      <div style={{ marginTop: "10px", borderBottom: "4px solid #b6b8be" }} />

      <div style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "26px" }}>
        <div>
          <div style={sectionLabelStyle}>BILL TO:</div>
          <div style={{ marginTop: "18px", display: "grid", gridTemplateColumns: "118px 1fr", gap: "12px" }}>
            <div style={{ ...sectionLabelStyle, lineHeight: 1.2 }}>
              Provider Or
              <br />
              Clinic
              <br />
              Referring
              <br />
              you
            </div>
            <div style={{ ...fieldValueStyle, lineHeight: 1.35 }}>{resolvedCompanyName}</div>
          </div>
        </div>

        <div>
          <div style={{ display: "grid", gridTemplateColumns: "132px 1fr", rowGap: "16px", columnGap: "18px" }}>
            <div style={sectionLabelStyle}>INVOICE No:</div>
            <div style={fieldValueStyle}>{resolvedInvoiceNumber}</div>
            <div style={{ ...sectionLabelStyle, lineHeight: 1.2, whiteSpace: "nowrap" }}>ASSESSMENT DATE:</div>
            <div style={fieldValueStyle}>{resolvedAssessmentDate}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "24px", fontSize: "0.95rem" }}>In relation to client:</div>

      <div
        style={{
          marginTop: "10px",
          background: "#eef2ff",
          borderTop: "4px solid #b6b8be",
          borderBottom: "4px solid #b6b8be",
          padding: "16px 12px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "20px", alignItems: "center" }}>
          <div style={{ fontSize: "0.95rem" }}>{resolvedAssessmentName}</div>
          <div style={{ ...sectionLabelStyle, minWidth: "70px" }}>RATE:</div>
          <div style={{ ...sectionLabelStyle, minWidth: "110px", textAlign: "right" }}>$ 500.00</div>
        </div>
      </div>

      <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "12px 26px", minWidth: "280px" }}>
          <div style={sectionLabelStyle}>SUBTOTAL:</div>
          <div style={{ ...sectionLabelStyle, textAlign: "right" }}>$ 500.00</div>
          <div style={sectionLabelStyle}>TOTAL:</div>
          <div style={{ ...sectionLabelStyle, textAlign: "right" }}>$ 500.00</div>
        </div>
      </div>

      <div style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1fr", alignItems: "start" }}>
        <div>
          <div style={sectionLabelStyle}>PAYABLE TO:</div>
          <div style={{ marginTop: "22px", lineHeight: 1.65, fontSize: "0.95rem" }}>
            <div>Valhalla Cell Health</div>
            <div>170 S 1200 E  #350</div>
            <div>Lehi, UT 84043</div>
          </div>
        </div>
      </div>

    </div>
  );
}