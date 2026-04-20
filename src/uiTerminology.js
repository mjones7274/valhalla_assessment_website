import { getSelectedCompany } from "./auth";

const normalizeCompanyTypeDescription = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z]/g, "");

export const shouldUseClientTerminology = (user = null, selectedCompany = null) => {
  try {
    const resolvedCompany =
      selectedCompany ??
      getSelectedCompany?.() ??
      user?.company ??
      user?.companies?.[0]?.company ??
      user?.companies?.[0] ??
      null;

    const description =
      resolvedCompany?.company_type?.description ??
      resolvedCompany?.company_type_description ??
      user?.company_type?.description ??
      user?.company_type_description ??
      "";

    const normalized = normalizeCompanyTypeDescription(description);
    return (
      normalized === "insurancecompany" ||
      normalized === "insurance" ||
      normalized === "lawfirm"
    );
  } catch {
    return false;
  }
};

const applyCase = (value, sample) => {
  if (!sample) return value;
  if (sample.toUpperCase() === sample) return value.toUpperCase();
  if (sample.toLowerCase() === sample) return value.toLowerCase();

  const looksTitleCase =
    sample[0] === sample[0].toUpperCase() &&
    sample.slice(1) === sample.slice(1).toLowerCase();

  if (looksTitleCase) {
    return value[0].toUpperCase() + value.slice(1).toLowerCase();
  }

  return value;
};

export const replacePatientText = (text, useClientTerminology) => {
  if (!useClientTerminology) return text;
  if (typeof text !== "string") return text;

  const singularBase = "client";
  const pluralBase = "clients";

  let next = text;

  // patients' (plural possessive)
  next = next.replace(/\b(patients)(['’])(?=\s|$|[.,;:!?)}\]])/gi, (match, base, apostrophe) => {
    const replacement = applyCase(pluralBase, base);
    return `${replacement}${apostrophe}`;
  });

  // patient / patients / patient's / patients's
  next = next.replace(/\b(patients?)(['’]s)?\b/gi, (match, base, possessive) => {
    const isPlural = String(base).toLowerCase() === "patients";
    const replacementBase = isPlural ? pluralBase : singularBase;
    const replacement = applyCase(replacementBase, base);
    return possessive ? `${replacement}${possessive}` : replacement;
  });

  return next;
};

export const getPatientLabels = (useClientTerminology) => {
  const singular = useClientTerminology ? "Client" : "Patient";
  const plural = useClientTerminology ? "Clients" : "Patients";
  return {
    singular,
    plural,
    singularLower: singular.toLowerCase(),
    pluralLower: plural.toLowerCase(),
  };
};
