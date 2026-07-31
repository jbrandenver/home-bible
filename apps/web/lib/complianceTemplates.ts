import type { ComplianceObligationType } from '@home-folder/shared';

// Curated starter catalog of rental compliance obligations.
//
// This is a STARTER LIST, not legal advice. It exists to save a landlord the
// blank-page problem — it does not replace reading the actual rule.
// Jurisdictions change requirements, fees, and cadences regularly: before
// relying on any entry, verify it against the linked official source (every
// reference_url points at a government site, never a blog). Entries with
// frequency_months: null are one-time or event-driven obligations (for
// example, triggered by a sale or by the start of a tenancy).

export type ComplianceTemplate = {
  /** Stable kebab-case identifier, unique across the catalog. */
  id: string;
  title: string;
  authority: string;
  /** Human jurisdiction label the UI filters on, e.g. "Seattle, WA" or "General". */
  jurisdiction: string;
  obligation_type: ComplianceObligationType;
  /** Renewal cadence in months; null for one-time / event-driven obligations. */
  frequency_months: number | null;
  /** Mandated record-retention period in years, when one exists. */
  retention_years: number | null;
  /** Official government reference page (https, .gov / official domain only). */
  reference_url: string;
  /** Plain-language summary including the deadline mechanics. */
  notes: string;
};

export const COMPLIANCE_TEMPLATES: readonly ComplianceTemplate[] = [
  {
    id: 'nyc-ll31-lead-xrf-inspection',
    title: 'Lead-based paint XRF inspection (Local Law 31)',
    authority: 'NYC Department of Housing Preservation and Development (HPD)',
    jurisdiction: 'New York City',
    obligation_type: 'inspection',
    frequency_months: null,
    retention_years: 10,
    reference_url: 'https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page',
    notes:
      'Owners of pre-1960 buildings (and 1960-1978 buildings with known lead paint) must have every unit tested for lead-based paint by an EPA-certified inspector using an XRF analyzer. One-time per unit rather than recurring, and inspection records must be kept for 10 years.'
  },
  {
    id: 'nyc-annual-lead-paint-notice',
    title: 'Annual lead paint notice to tenants',
    authority: 'NYC Department of Housing Preservation and Development (HPD)',
    jurisdiction: 'New York City',
    obligation_type: 'notice',
    frequency_months: 12,
    retention_years: 10,
    reference_url: 'https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page',
    notes:
      'Each January, owners of pre-1960 buildings must deliver the annual notice asking whether a child under six resides in each unit, and must follow up (including inspecting) where no response comes back. Keep proof of delivery and responses for 10 years.'
  },
  {
    id: 'seattle-rrio-registration-renewal',
    title: 'RRIO rental registration renewal',
    authority: 'Seattle Department of Construction and Inspections (SDCI)',
    jurisdiction: 'Seattle, WA',
    obligation_type: 'registration',
    frequency_months: 24,
    retention_years: null,
    reference_url: 'https://www.seattle.gov/rrio',
    notes:
      'Rental properties in Seattle must be registered under the Rental Registration and Inspection Ordinance (RRIO), and the registration must be renewed every 2 years. Registration is required before renting a unit, and units are subject to periodic RRIO inspections.'
  },
  {
    id: 'philadelphia-rental-license-renewal',
    title: 'Rental License annual renewal',
    authority: 'Philadelphia Department of Licenses and Inspections (L+I)',
    jurisdiction: 'Philadelphia, PA',
    obligation_type: 'license',
    frequency_months: 12,
    retention_years: null,
    reference_url:
      'https://www.phila.gov/services/permits-violations-licenses/get-a-license/business-licenses/rental-licenses/get-a-rental-license/',
    notes:
      'A Rental License must be renewed every year to lawfully rent residential property in Philadelphia; a lead-safe or lead-free certification is required for issuance and renewal. Without a current license the city can deny the right to collect rent.'
  },
  {
    id: 'philadelphia-lead-safe-certification',
    title: 'Lead-safe / lead-free certification',
    authority: 'Philadelphia Department of Public Health',
    jurisdiction: 'Philadelphia, PA',
    obligation_type: 'certification',
    frequency_months: 48,
    retention_years: null,
    reference_url: 'https://www.phila.gov/programs/lead-and-healthy-homes-program/',
    notes:
      'Rental units must be certified lead-safe or lead-free by a certified inspector, and the certification is a prerequisite for getting or renewing the Rental License. Lead-safe certifications are generally valid for four years; lead-free certifications do not expire — confirm your unit’s status with the city.'
  },
  {
    id: 'ma-smoke-co-certificate-at-sale',
    title: 'Smoke and CO alarm certificate at sale or transfer',
    authority: 'Massachusetts Department of Fire Services / local fire department',
    jurisdiction: 'Massachusetts',
    obligation_type: 'certification',
    frequency_months: null,
    retention_years: null,
    reference_url: 'https://www.mass.gov/orgs/department-of-fire-services',
    notes:
      'When a Massachusetts residence is sold or transferred, the local fire department must inspect the smoke and carbon monoxide alarms and issue a certificate of compliance before the closing. Event-driven rather than recurring — schedule the inspection when a sale is planned.'
  },
  {
    id: 'ca-security-deposit-photo-documentation',
    title: 'Security-deposit photo documentation (AB 2801)',
    authority: 'State of California (Civil Code section 1950.5)',
    jurisdiction: 'California',
    obligation_type: 'other',
    frequency_months: null,
    retention_years: null,
    reference_url:
      'https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2801',
    notes:
      'AB 2801 requires landlords to photograph the unit before or at the start of a tenancy (for tenancies beginning on or after July 1, 2025), at move-out before any repairs or cleaning, and again after repairs, and to provide the photos with the itemized deposit deduction statement. This app’s Condition Reports feature covers exactly this documentation, per tenancy rather than on a calendar.'
  },
  {
    id: 'general-annual-smoke-co-test',
    title: 'Annual smoke and CO detector test',
    authority: 'Local fire code / U.S. Fire Administration guidance',
    jurisdiction: 'General',
    obligation_type: 'inspection',
    frequency_months: 12,
    retention_years: null,
    reference_url: 'https://www.usfa.fema.gov/prevention/home-fires/prevent-fires/smoke-alarms/',
    notes:
      'Test the smoke and carbon monoxide alarms in every unit at least once a year (monthly testing is recommended), replacing batteries and expired units. Logging the date here builds a maintenance history you can show if it is ever questioned.'
  },
  {
    id: 'general-boiler-heating-annual-inspection',
    title: 'Boiler / heating system annual inspection',
    authority: 'State or local boiler inspection program',
    jurisdiction: 'General',
    obligation_type: 'inspection',
    frequency_months: 12,
    retention_years: null,
    reference_url: 'https://www.energy.gov/energysaver/home-heating-systems',
    notes:
      'Have the boiler or heating system professionally inspected and serviced once a year, before the heating season. Many states and cities also run mandatory periodic boiler inspection programs for rental buildings — check your local program’s exact cadence.'
  },
  {
    id: 'general-rental-registration-renewal',
    title: 'Rental registration renewal',
    authority: 'Local housing or licensing department',
    jurisdiction: 'General',
    obligation_type: 'registration',
    frequency_months: 12,
    retention_years: null,
    reference_url: 'https://www.hud.gov/states',
    notes:
      'Many cities and counties require landlords to register rental properties and renew the registration periodically — often annually, sometimes on a multi-year cycle. Check your local jurisdiction for the exact cadence, fees, and inspection requirements.'
  }
];
