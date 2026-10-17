import { test } from "node:test"
import assert from "node:assert/strict"
import { balanceOf, isStorableAmount, minorToNumber, sumMinor, toMinor } from "./minor-units.ts"

test("float sums that disagree are exact in minor units", () => {
    assert.notEqual(0.1 + 0.2, 0.3)
    assert.equal(sumMinor([0.1, 0.2]), toMinor(0.3))
})

test("a one-rupiah difference is not balanced", () => {
    const b = balanceOf([
        { debit: 1000000, credit: 0 },
        { debit: 0, credit: 999999 },
    ])
    assert.equal(b.balanced, false)
    assert.equal(minorToNumber(b.difference), 1)
})

test("cents are not rounded away", () => {
    const b = balanceOf([
        { debit: 100.5, credit: 0 },
        { debit: 0, credit: 100.49 },
    ])
    assert.equal(b.balanced, false)
    assert.equal(b.difference, toMinor("0.01"))
})

test("equal amounts balance, empty and all-zero entries do not", () => {
    assert.equal(balanceOf([{ debit: 12345.67, credit: 0 }, { debit: 0, credit: 12345.67 }]).balanced, true)
    assert.equal(balanceOf([]).balanced, false)
    assert.equal(balanceOf([{ debit: 0, credit: 0 }, { debit: 0, credit: 0 }]).balanced, false)
})

test("large rupiah totals stay exact", () => {
    const big = 9007199254740 // > 2^53 once multiplied by 10 000
    const b = balanceOf([{ debit: big, credit: 0 }, { debit: 0, credit: big }])
    assert.equal(b.balanced, true)
    assert.equal(b.debit, toMinor(big))
})

test("precision beyond the column scale is refused rather than rounded", () => {
    assert.throws(() => toMinor("0.00001"), RangeError)
    assert.equal(isStorableAmount(0.00001), false)
    assert.equal(isStorableAmount(10.1234), true)
    assert.equal(isStorableAmount(-1), false)
    assert.equal(isStorableAmount(Number.NaN), false)
    assert.equal(isStorableAmount(1e21), false)
})
