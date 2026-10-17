/**
 * Exact arithmetic for ledger amounts.
 *
 * The API stores money as decimal(19,4) and compares debits and credits with
 * `!=`. Summing JS numbers cannot promise that (0.1 + 0.2 !== 0.3), so a form
 * that compares float sums can say "balanced" for an entry the API rejects.
 * Amounts are therefore converted to integer minor units (1/10 000) as bigint,
 * summed and compared exactly.
 *
 * Input numbers are the shortest round-trip form of what the user typed, so
 * going through their string form loses nothing up to 15 significant digits.
 */

export const MINOR_SCALE = 4
const FACTOR = BigInt(10000)

export function toMinor(value: number | string): bigint {
    let text: string
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new RangeError("Amount must be a finite number")
        text = String(value)
    } else {
        text = value.trim()
    }

    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
    if (!match) throw new RangeError(`Not a plain decimal amount: ${text}`)

    const [, sign, whole, fraction = ""] = match
    if (/[1-9]/.test(fraction.slice(MINOR_SCALE))) {
        throw new RangeError(`More than ${MINOR_SCALE} decimal places: ${text}`)
    }

    const minor = BigInt(whole) * FACTOR + BigInt((fraction + "0000").slice(0, MINOR_SCALE))
    return sign ? -minor : minor
}

export function sumMinor(values: ReadonlyArray<number | string>): bigint {
    return values.reduce<bigint>((total, v) => total + toMinor(v), BigInt(0))
}

/** For display only; never compare or accumulate the result. */
export function minorToNumber(minor: bigint): number {
    return Number(minor) / Number(FACTOR)
}

/** True when the amount can be stored without rounding. */
export function isStorableAmount(value: number | string): boolean {
    try {
        const minor = toMinor(value)
        return minor >= BigInt(0) && minor < BigInt(10) ** BigInt(15 + MINOR_SCALE)
    } catch {
        return false
    }
}

export interface Balance {
    debit: bigint
    credit: bigint
    difference: bigint
    balanced: boolean
}

/** Exact comparison; an entry of zeros is not balanced, it is empty. */
export function balanceOf(lines: ReadonlyArray<{ debit: number | string; credit: number | string }>): Balance {
    const debit = sumMinor(lines.map((l) => l.debit || 0))
    const credit = sumMinor(lines.map((l) => l.credit || 0))
    const difference = debit > credit ? debit - credit : credit - debit
    return { debit, credit, difference, balanced: debit === credit && debit > BigInt(0) }
}
