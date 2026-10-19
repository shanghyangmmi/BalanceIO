import type { FinancialStatement, FinancialStatementPack } from "@/hooks/use-financial-statements"
import type { DocumentOptions } from "@/components/reports/statement-document"

/**
 * The statement set as a workbook: one sheet per statement, figures as
 * numbers (not text) so they can be footed in Excel, with the same
 * bilingual column order as the printed page.
 */

type Cell = { v: string | number; t: "s" | "n"; s?: Record<string, unknown>; z?: string }

const BOLD = { font: { bold: true, name: "Arial", sz: 10 } }
const PLAIN = { font: { name: "Arial", sz: 10 } }
const ITALIC = { font: { italic: true, name: "Arial", sz: 10, color: { rgb: "555555" } } }
const SUBTOTAL_BORDER = { top: { style: "thin", color: { rgb: "000000" } } }
const TOTAL_BORDER = { top: { style: "thin", color: { rgb: "000000" } }, bottom: { style: "double", color: { rgb: "000000" } } }

const SHEET_NAMES: Record<string, string> = {
  sofp: "Posisi Keuangan",
  pl: "Laba Rugi",
  equity: "Perubahan Ekuitas",
  cashflow: "Arus Kas",
  tb: "Neraca Saldo",
}

function text(v: string, style: Record<string, unknown> = PLAIN): Cell {
  return { v, t: "s", s: style }
}

export async function exportStatementsToExcel(pack: FinancialStatementPack, options: DocumentOptions) {
  const XLSX = await import("xlsx-js-style")
  const format = pack.hasFractions ? '#,##0.00;(#,##0.00);"-"' : '#,##0;(#,##0);"-"'
  const bilingual = options.language === "bilingual"
  const leftIsId = options.language === "id" || (bilingual && options.order === "id-en")
  const pick = (id: string, en: string) => (options.language === "en" ? en : options.language === "id" ? id : leftIsId ? `${id} / ${en}` : `${en} / ${id}`)

  const number = (value: number | null, border?: object, bold = false): Cell | null =>
    value === null ? null : { v: value, t: "n", z: format, s: { ...(bold ? BOLD : PLAIN), numFmt: format, ...(border ? { border } : {}) } }

  const wb = XLSX.utils.book_new()

  for (const statement of pack.statements.filter((s) => options.include[s.key] !== false)) {
    const rows: (Cell | null)[][] = [
      [text(pack.companyName.toUpperCase(), BOLD)],
      [text(pick(statement.titleId, statement.titleEn), BOLD)],
      [text(pick(statement.basisId, statement.basisEn))],
      [text(pick("(Disajikan dalam Rupiah)", "(Expressed in Rupiah)"), ITALIC)],
      [],
    ]

    if (statement.key === "tb") {
      rows.push(tbHeader(pick, bilingual, leftIsId))
      for (const line of statement.lines) {
        const total = line.kind === "total"
        const border = total ? TOTAL_BORDER : undefined
        rows.push([
          text(line.code ?? "", total ? BOLD : PLAIN),
          text(leftIsId ? line.labelId : line.labelEn, total ? BOLD : PLAIN),
          number(line.current ?? (total ? 0 : null), border, total),
          number(line.credit ?? (total ? 0 : null), border, total),
          ...(bilingual ? [text(leftIsId ? line.labelEn : line.labelId, ITALIC)] : []),
        ])
      }
    } else {
      rows.push(header(pack, bilingual))
      for (const line of statement.lines) {
        rows.push(statementRow(statement, line, pack, bilingual, leftIsId, number))
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => c ?? { v: "", t: "s" })))
    ws["!cols"] = statement.key === "tb"
      ? [{ wch: 10 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, ...(bilingual ? [{ wch: 40 }] : [])]
      : [{ wch: 48 }, { wch: 18 }, ...(pack.comparative ? [{ wch: 18 }] : []), ...(bilingual ? [{ wch: 48 }] : [])]
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAMES[statement.key] ?? statement.key)
  }

  const safeName = pack.companyName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Company"
  XLSX.writeFile(wb, `Laporan_Keuangan_${safeName}_${pack.periodEnd}.xlsx`)
}

function header(pack: FinancialStatementPack, bilingual: boolean): (Cell | null)[] {
  const right = { ...BOLD, alignment: { horizontal: "right" }, border: { bottom: { style: "thin", color: { rgb: "000000" } } } }
  return [
    text(""),
    { v: pack.columnCurrent, t: "s", s: right },
    ...(pack.comparative && pack.columnPrior ? [{ v: pack.columnPrior, t: "s" as const, s: right }] : []),
    ...(bilingual ? [text("")] : []),
  ]
}

function tbHeader(pick: (id: string, en: string) => string, bilingual: boolean, leftIsId: boolean): Cell[] {
  const h = { ...BOLD, border: { bottom: { style: "thin", color: { rgb: "000000" } } } }
  return [
    text(pick("Kode", "Code"), h),
    text(leftIsId ? "Nama akun" : "Account name", h),
    text("Debit", h),
    text(pick("Kredit", "Credit"), h),
    ...(bilingual ? [text(leftIsId ? "Account name" : "Nama akun", h)] : []),
  ]
}

function statementRow(
  _statement: FinancialStatement,
  line: FinancialStatement["lines"][number],
  pack: FinancialStatementPack,
  bilingual: boolean,
  leftIsId: boolean,
  number: (value: number | null, border?: object, bold?: boolean) => Cell | null,
): (Cell | null)[] {
  const strong = line.kind !== "item"
  const indent = "    ".repeat(line.indent)
  const style = strong ? BOLD : PLAIN
  const labels = leftIsId ? [line.labelId, line.labelEn] : [line.labelEn, line.labelId]
  const border = line.kind === "subtotal" ? SUBTOTAL_BORDER : line.kind === "total" ? TOTAL_BORDER : undefined
  const blank = line.kind === "section" || line.kind === "heading"

  return [
    text(indent + labels[0], style),
    blank ? null : number(line.current, border, strong),
    ...(pack.comparative ? [blank ? null : number(line.prior, border, strong)] : []),
    ...(bilingual ? [text(indent + labels[1], strong ? { font: { ...ITALIC.font, bold: true } } : ITALIC)] : []),
  ]
}
