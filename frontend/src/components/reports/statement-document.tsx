import { Fragment } from "react"

import { cn } from "@/lib/utils"
import type {
  FinancialStatement,
  FinancialStatementPack,
  StatementLine,
} from "@/hooks/use-financial-statements"

/**
 * The statement set as printed paper.
 *
 * Bilingual layout follows Indonesian practice: the Indonesian description
 * on one side, the figures in the middle, the English translation on the
 * other. Indonesian is the governing text (UU 24/2009), so it sits on the
 * left by default; the order can be reversed.
 *
 * Paper is paper: black on white in both themes, Lato, A4. Negative
 * figures in parentheses, nil as a dash, a single rule above subtotals
 * and a double rule under totals.
 */

export type StatementLanguage = "bilingual" | "id" | "en"
export type StatementOrder = "id-en" | "en-id"

export interface DocumentOptions {
  language: StatementLanguage
  order: StatementOrder
  include: Record<string, boolean>
}

export function formatStatementAmount(value: number | null, decimals: number, locale: string) {
  if (value === null) return ""
  if (value === 0) return "-"
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value))
  return value < 0 ? `(${text})` : text
}

function DateLong({ iso, lang }: { iso: string; lang: "id" | "en" }) {
  const [y, m, d] = iso.split("-").map(Number)
  return (
    <>
      {new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(y, m - 1, d),
      )}
    </>
  )
}

/** Two labels in the order the options ask for, or the one the language asks for. */
function Bi({ id, en, options, className }: { id: string; en: string; options: DocumentOptions; className?: string }) {
  if (options.language === "id") return <div className={className}>{id}</div>
  if (options.language === "en") return <div className={className}>{en}</div>
  const [first, second] = options.order === "id-en" ? [id, en] : [en, id]
  return (
    <div className={className}>
      <div>{first}</div>
      <div className="italic text-neutral-600">{second}</div>
    </div>
  )
}

export function StatementDocument({ pack, options }: { pack: FinancialStatementPack; options: DocumentOptions }) {
  const statements = pack.statements.filter((s) => options.include[s.key] !== false)
  const pl = pack.statements.find((s) => s.key === "pl")

  return (
    <div className="statement-paper space-y-6 text-[10.5px] leading-[1.45] text-black print:space-y-0">
      <section className="statement-page flex min-h-[250mm] flex-col">
        <div className="pt-[30mm] text-center">
          <div className="text-[18px] font-black uppercase tracking-wide">{pack.companyName}</div>
          {pack.companyTaxId && <div className="mt-1 text-[10px] text-neutral-600">NPWP {pack.companyTaxId}</div>}
          {pack.companyAddress && <div className="mt-0.5 text-[10px] text-neutral-600">{pack.companyAddress}</div>}

          <div className="mx-auto my-10 h-px w-24 bg-black" />

          <Bi id="LAPORAN KEUANGAN" en="FINANCIAL STATEMENTS" options={options} className="text-[16px] font-bold tracking-wide" />
          {pl && <Bi id={pl.basisId} en={pl.basisEn} options={options} className="mt-3 text-[11px]" />}
          <Bi id="(Tidak diaudit)" en="(Unaudited)" options={options} className="mt-3 text-[10px] text-neutral-600" />
        </div>

        <div className="mx-auto mt-16 w-full max-w-[120mm]">
          <Bi id="Daftar isi" en="Contents" options={options} className="mb-2 text-[10px] font-bold uppercase tracking-wider" />
          <ol className="border-t border-black">
            {statements.map((s, i) => (
              <li key={s.key} className="flex gap-3 border-b border-neutral-300 py-1.5">
                <span className="w-4 tabular-nums">{i + 1}.</span>
                <Bi id={s.titleId} en={s.titleEn} options={options} />
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-auto pt-10 text-center text-[9px] text-neutral-600">
          <Bi
            id="Laporan ini disusun oleh manajemen dari buku besar dan belum diaudit."
            en="Prepared by management from the general ledger; not audited."
            options={options}
          />
          <div className="mt-1">
            {options.language === "en" ? "Generated" : "Dibuat"}{" "}
            <DateLong iso={pack.generatedAt.slice(0, 10)} lang={options.language === "en" ? "en" : "id"} />
            {pack.generatedBy && ` · ${pack.generatedBy}`}
          </div>
        </div>
      </section>

      {statements.map((s) => (
        <StatementPage key={s.key} pack={pack} statement={s} options={options} />
      ))}
    </div>
  )
}

function StatementPage({ pack, statement, options }: { pack: FinancialStatementPack; statement: FinancialStatement; options: DocumentOptions }) {
  const failed = statement.checks.filter((c) => !c.passed)
  const decimals = pack.hasFractions ? 2 : 0
  const locale = options.language === "en" ? "en-US" : "id-ID"
  const currencyId = pack.currency === "IDR" ? "Rupiah" : pack.currency
  const currencyEn = pack.currency === "IDR" ? "Rupiah" : pack.currency

  return (
    <section className="statement-page statement-break">
      <header className="mb-5 text-center">
        <div className="text-[12px] font-black uppercase tracking-wide">{pack.companyName}</div>
        <Bi id={statement.titleId.toUpperCase()} en={statement.titleEn.toUpperCase()} options={options} className="mt-1 text-[11px] font-bold" />
        <Bi id={statement.basisId} en={statement.basisEn} options={options} className="mt-1" />
        <Bi
          id={`(Disajikan dalam ${currencyId}, kecuali dinyatakan lain)`}
          en={`(Expressed in ${currencyEn}, unless otherwise stated)`}
          options={options}
          className="mt-1 text-[9.5px] text-neutral-600"
        />
      </header>

      {statement.key === "tb" ? (
        <TrialBalanceTable statement={statement} options={options} decimals={decimals} locale={locale} />
      ) : (
        <StatementTable pack={pack} statement={statement} options={options} decimals={decimals} locale={locale} />
      )}

      {failed.length > 0 && (
        <div className="mt-4 border border-red-700 p-2 text-[9.5px] text-red-800">
          {failed.map((c) => (
            <Bi
              key={c.labelEn}
              id={`Pemeriksaan gagal: ${c.labelId}. Selisih ${formatStatementAmount(c.difference, decimals, locale)}.`}
              en={`Check failed: ${c.labelEn}. Difference ${formatStatementAmount(c.difference, decimals, locale)}.`}
              options={options}
            />
          ))}
        </div>
      )}

      <p className="mt-6 border-t border-neutral-300 pt-2 text-[8.5px] text-neutral-600">
        {options.language === "en"
          ? "Prepared by management from the general ledger; not audited."
          : options.language === "id"
            ? "Disusun oleh manajemen dari buku besar dan belum diaudit."
            : options.order === "id-en"
              ? "Disusun oleh manajemen dari buku besar dan belum diaudit. / Prepared by management from the general ledger; not audited."
              : "Prepared by management from the general ledger; not audited. / Disusun oleh manajemen dari buku besar dan belum diaudit."}
      </p>
    </section>
  )
}

const ROW: Record<StatementLine["kind"], string> = {
  section: "font-bold uppercase pt-3",
  heading: "font-bold pt-2",
  item: "",
  subtotal: "font-bold",
  total: "font-black pt-1",
}

function amountCell(kind: StatementLine["kind"]) {
  return cn(
    "px-2 py-[2px] text-right align-bottom tabular-nums whitespace-nowrap",
    kind === "subtotal" && "border-t border-black",
    kind === "total" && "border-t border-black border-b-[3px] border-b-black [border-bottom-style:double]",
  )
}

function StatementTable({
  pack,
  statement,
  options,
  decimals,
  locale,
}: {
  pack: FinancialStatementPack
  statement: FinancialStatement
  options: DocumentOptions
  decimals: number
  locale: string
}) {
  const bilingual = options.language === "bilingual"
  const leftIsId = options.language === "id" || (bilingual && options.order === "id-en")
  const prior = pack.comparative && pack.columnPrior

  const label = (line: StatementLine, which: "left" | "right") => {
    const id = which === "left" ? leftIsId : !leftIsId
    return id ? line.labelId : line.labelEn
  }

  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className={bilingual ? "w-[34%]" : "w-[60%]"} />
        <col className="w-[16%]" />
        {prior && <col className="w-[16%]" />}
        {bilingual && <col className="w-[34%]" />}
      </colgroup>
      <thead>
        <tr className="text-[10px] font-bold">
          <th />
          <th className="border-b border-black px-2 py-1 text-right">{pack.columnCurrent}</th>
          {prior && <th className="border-b border-black px-2 py-1 text-right">{pack.columnPrior}</th>}
          {bilingual && <th />}
        </tr>
      </thead>
      <tbody>
        {statement.lines.map((line, i) => {
          const pad = { paddingLeft: `${line.indent * 12}px` }
          return (
            <Fragment key={i}>
              <tr className={cn("break-inside-avoid", ROW[line.kind])}>
                <td className="py-[2px] pr-2 align-bottom" style={pad}>
                  {label(line, "left")}
                </td>
                <td className={amountCell(line.kind)}>
                  {line.kind === "section" || line.kind === "heading" ? "" : formatStatementAmount(line.current, decimals, locale)}
                </td>
                {prior && (
                  <td className={amountCell(line.kind)}>
                    {line.kind === "section" || line.kind === "heading" ? "" : formatStatementAmount(line.prior, decimals, locale)}
                  </td>
                )}
                {bilingual && (
                  <td className="py-[2px] pl-3 align-bottom italic text-neutral-700" style={pad}>
                    {label(line, "right")}
                  </td>
                )}
              </tr>
              {line.kind === "total" && (
                <tr aria-hidden>
                  <td className="h-2" colSpan={4} />
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function TrialBalanceTable({
  statement,
  options,
  decimals,
  locale,
}: {
  statement: FinancialStatement
  options: DocumentOptions
  decimals: number
  locale: string
}) {
  const bilingual = options.language === "bilingual"
  const leftIsId = options.language === "id" || (bilingual && options.order === "id-en")
  const head = (id: string, en: string) => (options.language === "en" ? en : options.language === "id" ? id : leftIsId ? `${id} / ${en}` : `${en} / ${id}`)

  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-[10%]" />
        <col className={bilingual ? "w-[30%]" : "w-[54%]"} />
        <col className="w-[18%]" />
        <col className="w-[18%]" />
        {bilingual && <col className="w-[24%]" />}
      </colgroup>
      <thead>
        <tr className="border-b border-black text-[9.5px] font-bold">
          <th className="py-1 text-left">{head("Kode", "Code")}</th>
          <th className="py-1 text-left">{leftIsId ? "Nama akun" : "Account name"}</th>
          <th className="px-2 py-1 text-right">Debit</th>
          <th className="px-2 py-1 text-right">{head("Kredit", "Credit")}</th>
          {bilingual && <th className="py-1 pl-3 text-left italic">{leftIsId ? "Account name" : "Nama akun"}</th>}
        </tr>
      </thead>
      <tbody>
        {statement.lines.map((line, i) => {
          const total = line.kind === "total"
          return (
            <tr key={i} className={cn("break-inside-avoid", total && "font-black")}>
              <td className="py-[2px] font-mono text-[9.5px]">{line.code}</td>
              <td className="py-[2px] pr-2">{leftIsId ? line.labelId : line.labelEn}</td>
              <td className={amountCell(line.kind)}>{formatStatementAmount(line.current, decimals, locale) || (total ? "-" : "")}</td>
              <td className={amountCell(line.kind)}>{formatStatementAmount(line.credit, decimals, locale) || (total ? "-" : "")}</td>
              {bilingual && <td className="py-[2px] pl-3 italic text-neutral-700">{leftIsId ? line.labelEn : line.labelId}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
