import type { CardSpec } from "./paper"

/**
 * Everything printed on a card.
 *
 * Three rules govern this file, and all three are accounting rules rather
 * than design ones:
 *
 *   1. Every figure ties. Dr equals Cr on every entry; PPN is 11% of the
 *      base it sits on; the statements foot to their own totals. A hero
 *      animation for accounting software that does not add up is worse
 *      than no animation.
 *   2. Nothing is a placeholder. The ledger pile used to be blank ruled
 *      paper, which read as a rendering bug the moment the camera came
 *      close - correctly, because a blank general ledger is a bug.
 *   3. Periods are what they claim to be. The ledger pages cover one
 *      month; the statements cover the year, and their figures are sized
 *      accordingly. They previously shared the same numbers, which made
 *      a year of revenue equal to one August.
 *
 * Naming: account and statement names in English; Indonesian tax codes
 * stay as codes - PPN, PPh 21, SPT Masa - with the English qualifier
 * beside them rather than an Indonesian one.
 */

/**
 * The financial year every date on every card is drawn from.
 *
 * The current calendar year, resolved at runtime, so the page needs no
 * edit in January.
 *
 * The trade-off was considered and taken deliberately: for most of the
 * year this dates the Statement of Financial Position "as at 31 Dec" of a
 * year still running, which is a forward date. The alternative - the last
 * completed year - is what a published annual report shows, but it leaves
 * the hero reading a year behind for twelve months, and a landing page
 * that looks unmaintained costs more than a label that reads as the
 * current financial year.
 */
export function bookYear(): number {
  return new Date().getFullYear()
}

export interface Variant {
  doc: CardSpec
  debit: CardSpec
  credit: CardSpec
  /** Null when the transaction genuinely produces no tax. */
  tax: CardSpec | null
}

export function buildVariants(y: number): Variant[] {
  return [
    // ── A sale. 42 M base + 11% PPN 4,62 M = 46,62 M ────────────
    {
      doc: {
        eyebrow: "Sales invoice",
        reference: `INV-${y}-08-014`,
        title: "PT BalanceIO Digital Indonesia",
        rows: [
          { label: "Consulting services", value: "42.000.000.000" },
          { label: "PPN · Output 11%", value: "4.620.000.000" },
        ],
        footLabel: "Amount due",
        footValue: "46.620.000.000",
        rule: "line",
      },
      debit: {
        eyebrow: "Debit",
        title: "Accounts Receivable",
        rows: [{ label: "1-1200 · Trade receivable", value: "46.620.000.000", tone: "accent" }],
        footLabel: "Dr",
        footValue: "46.620.000.000",
        footTone: "accent",
        rule: "accent",
      },
      credit: {
        eyebrow: "Credit",
        title: "Revenue · PPN Output",
        rows: [
          { label: "4-1000 · Sales", value: "42.000.000.000", tone: "secondary" },
          { label: "2-1400 · PPN Output", value: "4.620.000.000", tone: "secondary" },
        ],
        footLabel: "Cr",
        footValue: "46.620.000.000",
        footTone: "secondary",
        rule: "secondary",
      },
      tax: {
        eyebrow: "Tax",
        reference: "SPT Masa PPN",
        title: "PPN · Output",
        rows: [
          { label: "Taxable base", value: "42.000.000.000" },
          { label: "Rate", value: "11%" },
        ],
        footLabel: "Payable",
        footValue: "4.620.000.000",
        rule: "line",
      },
    },

    // ── A purchase. 68 M base + 11% PPN 7,48 M = 75,48 M ─────────
    {
      doc: {
        eyebrow: "Purchase bill",
        reference: `BIL-${y}-08-007`,
        title: "Production machinery",
        rows: [
          { label: "Goods received", value: "68.000.000.000" },
          { label: "PPN · Input 11%", value: "7.480.000.000" },
        ],
        footLabel: "Amount payable",
        footValue: "75.480.000.000",
        rule: "line",
      },
      debit: {
        eyebrow: "Debit",
        title: "Equipment · PPN Input",
        rows: [
          { label: "1-2100 · Machinery and equipment", value: "68.000.000.000", tone: "accent" },
          { label: "1-1700 · PPN Input", value: "7.480.000.000", tone: "accent" },
        ],
        footLabel: "Dr",
        footValue: "75.480.000.000",
        footTone: "accent",
        rule: "accent",
      },
      credit: {
        eyebrow: "Credit",
        title: "Accounts Payable",
        rows: [{ label: "2-1100 · Trade payable", value: "75.480.000.000", tone: "secondary" }],
        footLabel: "Cr",
        footValue: "75.480.000.000",
        footTone: "secondary",
        rule: "secondary",
      },
      tax: {
        eyebrow: "Tax",
        reference: "SPT Masa PPN",
        title: "PPN · Input",
        rows: [
          { label: "Taxable base", value: "68.000.000.000" },
          { label: "Rate", value: "11%" },
        ],
        footLabel: "Creditable",
        footValue: "7.480.000.000",
        rule: "line",
      },
    },

    // ── Payroll. 5,328 M withheld + 121,072 M net = 126,4 M ────
    {
      doc: {
        eyebrow: "Payroll run",
        reference: `PAY-${y}-08`,
        title: "4.200 employees",
        rows: [
          { label: "Gross salary", value: "126.400.000.000" },
          { label: "PPh 21 withheld", value: "5.328.000.000" },
        ],
        footLabel: "Net paid",
        footValue: "121.072.000.000",
        rule: "line",
      },
      debit: {
        eyebrow: "Debit",
        title: "Salary Expense",
        rows: [{ label: "6-1100 · Salaries and wages", value: "126.400.000.000", tone: "accent" }],
        footLabel: "Dr",
        footValue: "126.400.000.000",
        footTone: "accent",
        rule: "accent",
      },
      credit: {
        eyebrow: "Credit",
        title: "PPh 21 Payable · Cash",
        rows: [
          { label: "2-1500 · PPh 21 payable", value: "5.328.000.000", tone: "secondary" },
          { label: "1-1100 · Cash and bank", value: "121.072.000.000", tone: "secondary" },
        ],
        footLabel: "Cr",
        footValue: "126.400.000.000",
        footTone: "secondary",
        rule: "secondary",
      },
      tax: {
        eyebrow: "Tax",
        reference: "SPT Masa PPh 21",
        title: "PPh 21",
        rows: [
          { label: "Employees", value: "4.200" },
          { label: "Gross", value: "126.400.000.000" },
        ],
        footLabel: "Withheld",
        footValue: "5.328.000.000",
        rule: "line",
      },
    },

    // ── Cost of goods sold on despatch. No tax arises. ─────────────
    {
      doc: {
        eyebrow: "Delivery order",
        reference: `DO-${y}-08-021`,
        title: "Goods issued from stock",
        rows: [
          { label: "Units despatched", value: "4.000" },
          { label: "Weighted average cost", value: "7.910.000" },
        ],
        footLabel: "Cost of goods sold",
        footValue: "31.640.000.000",
        rule: "line",
      },
      debit: {
        eyebrow: "Debit",
        title: "Cost of Goods Sold",
        rows: [{ label: "5-1000 · Cost of goods sold", value: "31.640.000.000", tone: "accent" }],
        footLabel: "Dr",
        footValue: "31.640.000.000",
        footTone: "accent",
        rule: "accent",
      },
      credit: {
        eyebrow: "Credit",
        title: "Inventory",
        rows: [{ label: "1-1400 · Merchandise inventory", value: "31.640.000.000", tone: "secondary" }],
        footLabel: "Cr",
        footValue: "31.640.000.000",
        footTone: "secondary",
        rule: "secondary",
      },
      // Moving stock to COGS is an internal transfer. No PPN, no PPh.
      tax: null,
    },

    // ── Depreciation. A 246 M fleet over 60 months = 4,1 M/mo ──────
    {
      doc: {
        eyebrow: "Depreciation",
        reference: `DEP-${y}-08`,
        title: "Vehicle fleet",
        rows: [
          { label: "Acquisition cost", value: "246.000.000.000" },
          { label: "Useful life", value: "60 months" },
        ],
        footLabel: "Monthly charge",
        footValue: "4.100.000.000",
        rule: "line",
      },
      debit: {
        eyebrow: "Debit",
        title: "Depreciation Expense",
        rows: [{ label: "6-3000 · Depreciation", value: "4.100.000.000", tone: "accent" }],
        footLabel: "Dr",
        footValue: "4.100.000.000",
        footTone: "accent",
        rule: "accent",
      },
      credit: {
        eyebrow: "Credit",
        title: "Accumulated Depreciation",
        rows: [{ label: "1-2900 · Accumulated depreciation", value: "4.100.000.000", tone: "secondary" }],
        footLabel: "Cr",
        footValue: "4.100.000.000",
        footTone: "secondary",
        rule: "secondary",
      },
      // A depreciation charge throws off no tax. An empty tax card would
      // be a lie about the accounting.
      tax: null,
    },
  ]
}

/**
 * Pages of the general ledger itself, covering one month. The pile is
 * made of these, so it reads as posted accounts rather than as blank
 * stationery.
 */
export function buildLedgerPages(y: number): CardSpec[] {
  return [
    {
      eyebrow: "General ledger",
      reference: "1-1100",
      title: "Cash and Bank",
      rows: [
        { label: "01 Aug · Opening balance", value: "318.400.000.000", tone: "accent" },
        { label: `06 Aug · RCP-${y}-08-004`, value: "46.620.000.000", tone: "accent" },
        { label: `18 Aug · PAY-${y}-08`, value: "121.072.000.000", tone: "secondary" },
        { label: `24 Aug · BIL-${y}-08-007`, value: "75.480.000.000", tone: "secondary" },
      ],
      footLabel: "Closing balance",
      footValue: "168.468.000.000",
      rule: "line",
    },
    {
      eyebrow: "General ledger",
      reference: "4-1000",
      title: "Sales",
      rows: [
        { label: `06 Aug · INV-${y}-08-011`, value: "58.900.000.000", tone: "secondary" },
        { label: `14 Aug · INV-${y}-08-013`, value: "72.400.000.000", tone: "secondary" },
        { label: `21 Aug · INV-${y}-08-014`, value: "42.000.000.000", tone: "secondary" },
        { label: `28 Aug · INV-${y}-08-016`, value: "95.100.000.000", tone: "secondary" },
      ],
      footLabel: "August total",
      footValue: "268.400.000.000",
      rule: "secondary",
    },
    {
      eyebrow: "General ledger",
      reference: "2-1400",
      title: "PPN Output",
      rows: [
        { label: `06 Aug · INV-${y}-08-011`, value: "6.479.000.000", tone: "secondary" },
        { label: `14 Aug · INV-${y}-08-013`, value: "7.964.000.000", tone: "secondary" },
        { label: `21 Aug · INV-${y}-08-014`, value: "4.620.000.000", tone: "secondary" },
        { label: `28 Aug · INV-${y}-08-016`, value: "10.461.000.000", tone: "secondary" },
      ],
      footLabel: "Payable",
      footValue: "29.524.000.000",
      rule: "secondary",
    },
  ]
}

/**
 * The three primary statements, for the financial year.
 *
 * Annual, not monthly, because that is the period a set of financial
 * statements covers - and the figures are sized for a year rather than
 * reusing the ledger's August totals, which would have made twelve
 * months of revenue identical to one month of it.
 */
export function buildStatements(y: number): CardSpec[] {
  return [
    {
      eyebrow: "SoCI",
      reference: `FY ${y}`,
      title: "Statement of Comprehensive Income",
      rows: [
        { label: "Revenue", value: "3.184.600.000.000", tone: "secondary" },
        { label: "Cost of sales", value: "(1.412.300.000.000)", tone: "accent" },
        { label: "Operating expenses", value: "(1.108.450.000.000)", tone: "accent" },
      ],
      footLabel: "Profit for the year",
      footValue: "663.850.000.000",
      footTone: "secondary",
      rule: "secondary",
    },
    {
      eyebrow: "SoFP",
      reference: `31 Dec ${y}`,
      title: "Statement of Financial Position",
      rows: [
        { label: "Total assets", value: "4.286.500.000.000", tone: "accent" },
        { label: "Total liabilities", value: "1.318.750.000.000", tone: "secondary" },
        { label: "Total equity", value: "2.967.750.000.000", tone: "secondary" },
      ],
      // 4.286.500.000.000 = 1.318.750.000.000 + 2.967.750.000.000
      footLabel: "Assets − (L + E)",
      footValue: "0,00",
      rule: "line",
    },
    {
      eyebrow: "SoCF",
      reference: `FY ${y}`,
      title: "Statement of Cash Flows",
      rows: [
        { label: "Operating", value: "812.400.000.000", tone: "accent" },
        { label: "Investing", value: "(445.000.000.000)", tone: "secondary" },
        { label: "Financing", value: "180.000.000.000", tone: "accent" },
      ],
      footLabel: "Net change in cash",
      footValue: "547.400.000.000",
      rule: "line",
    },
  ]
}
