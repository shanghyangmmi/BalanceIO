"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils/formatter"
import { useState, useEffect } from "react"
import { CreditCard, Wallet, Loader2, TrendingUp, TrendingDown, Scale } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PayBillModalProps {
    billId: string;
    billNumber?: string;
    vendorName: string;
    amountDue: number;
    currency?: string;
    bookedExchangeRate?: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface CashAccount {
    id: string;
    code: string;
    name: string;
}

function formatIDR(amount: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function PayBillModal({
    billId,
    billNumber,
    vendorName,
    amountDue,
    currency = "IDR",
    bookedExchangeRate = 1,
    isOpen,
    onClose,
    onSuccess
}: PayBillModalProps) {
    const displayBillNumber = billNumber || billId;
    const isForeign = currency !== "IDR";
    const [amount, setAmount] = useState(amountDue);
    const [paymentAccountId, setPaymentAccountId] = useState("");
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [settlementRate, setSettlementRate] = useState<number>(bookedExchangeRate > 0 ? bookedExchangeRate : 1);
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(1); // 1 = BankTransfer
    const [reference, setReference] = useState("");
    const [accounts, setAccounts] = useState<CashAccount[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setAmount(amountDue);
    }, [amountDue, isOpen]);

    // Fetch cash/bank accounts
    useEffect(() => {
        async function fetchAccounts() {
            try {
                const data = await apiClient.getAccounts();
                const cashAndBank = data.filter((a: any) => 
                    !a.isHeader && (a.code.startsWith("1-11") || a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("cash"))
                );
                setAccounts(cashAndBank);
                if (cashAndBank.length > 0 && !paymentAccountId) {
                    setPaymentAccountId(cashAndBank[0].id);
                }
            } catch (err) {
                console.error("Failed to load accounts", err);
            }
        }
        if (isOpen) {
            fetchAccounts();
        }
    }, [isOpen]);

    // Fetch spot rate on date change for foreign currency
    useEffect(() => {
        async function fetchSpotRate() {
            if (!isForeign) return;
            setIsLoadingRate(true);
            try {
                const middleRate = await apiClient.getExchangeMiddleRate(paymentDate, currency);
                if (middleRate && middleRate > 0) {
                    setSettlementRate(middleRate);
                }
            } catch (e) {
                // If specific date rate is missing, keep existing
            } finally {
                setIsLoadingRate(false);
            }
        }

        if (isOpen && isForeign) {
            fetchSpotRate();
        }
    }, [paymentDate, currency, isOpen, isForeign]);

    // Multi-currency calculation
    const effectiveBookedRate = bookedExchangeRate > 0 ? bookedExchangeRate : 1;
    const bookedApIdr = isForeign ? amount * effectiveBookedRate : amount;
    const settlementBankIdr = isForeign ? amount * settlementRate : amount;
    const realisedDiff = settlementBankIdr - bookedApIdr; // > 0 means paid more IDR (Loss)

    const handlePay = async () => {
        if (!paymentAccountId) {
            toast.error("Please select a payment account.");
            return;
        }

        if (amount <= 0) {
            toast.error("Payment amount must be greater than zero.");
            return;
        }

        try {
            setIsSubmitting(true);

            // 1. Create Payment Voucher with transaction currency and settlement exchange rate
            const voucher = await apiClient.createPaymentVoucher({
                paymentDate: paymentDate,
                paymentType: 0, // Vendor
                paymentAccountId: paymentAccountId,
                paymentMethod: paymentMethod,
                paymentReference: reference || `Payment for Bill #${displayBillNumber}`,
                currency: currency,
                exchangeRate: isForeign ? settlementRate : 1,
                totalAmount: amount,
                description: `Payment to ${vendorName} for bill ${displayBillNumber}`,
                lines: [
                    {
                        purchaseBillId: billId,
                        description: `Payment for Bill #${displayBillNumber} (${currency} ${amount.toLocaleString()})`,
                        amount: amount
                    }
                ]
            });

            // 2. Post Payment Voucher (Creates journal entry, settles AP, and records FX difference)
            await apiClient.postPaymentVoucher(voucher.id);

            toast.success(`Payment of ${isForeign ? `${currency} ${amount.toLocaleString()}` : formatCurrency(amount)} recorded & posted successfully.`);
            onClose();
            if (onSuccess) {
                onSuccess();
            }
        } catch (error: any) {
            console.error("Failed to record payment", error);
            toast.error(error.message || "Failed to record payment");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2">
                        Pay Purchase Bill
                        {isForeign && (
                            <Badge variant="outline" className="border-indigo-400 text-indigo-700 dark:text-indigo-300 font-mono text-[11px]">
                                {currency} Multi-Currency
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Record and settle vendor bill <span className="font-mono font-medium text-foreground">#{displayBillNumber}</span> ({vendorName})
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Amount Card */}
                    <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl flex justify-between items-center">
                        <div>
                            <span className="text-xs text-blue-800 dark:text-blue-300 font-medium block">
                                Amount Payable ({currency})
                            </span>
                            {isForeign && (
                                <span className="text-[11px] text-muted-foreground font-mono">
                                    Booked @ Rp {effectiveBookedRate.toLocaleString("id-ID")} = {formatIDR(amountDue * effectiveBookedRate)}
                                </span>
                            )}
                        </div>
                        <span className="text-xl font-bold font-money text-blue-700 dark:text-blue-400">
                            {isForeign ? `${currency} ${amountDue.toLocaleString()}` : formatCurrency(amountDue)}
                        </span>
                    </div>

                    {/* Multi-Currency Settlement Rate Box */}
                    {isForeign && (
                        <div className="p-3.5 bg-card/60 border border-border/80 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                                    <Scale className="h-3.5 w-3.5 text-indigo-600" />
                                    Settlement Spot Rate ({currency}/IDR)
                                </span>
                                {isLoadingRate && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Fetching JISDOR...
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-[11px] text-muted-foreground font-mono">Booked Spot Rate</Label>
                                    <div className="h-8 px-2.5 flex items-center bg-muted/40 rounded-md border border-border/40 font-mono text-xs font-semibold text-muted-foreground">
                                        Rp {effectiveBookedRate.toLocaleString("id-ID")}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-[11px] text-muted-foreground font-mono">Settlement Spot Rate</Label>
                                    <Input
                                        type="number"
                                        step="1"
                                        value={settlementRate}
                                        onChange={(e) => setSettlementRate(parseFloat(e.target.value) || 0)}
                                        className="h-8 text-xs font-mono font-bold text-foreground"
                                    />
                                </div>
                            </div>

                            {/* Realised Gain / Loss Real-time preview */}
                            <div className={cn(
                                "p-2.5 rounded-lg border text-xs flex items-center justify-between font-mono",
                                realisedDiff <= 0
                                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                                    : "bg-amber-50/50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
                            )}>
                                <span className="flex items-center gap-1 font-semibold">
                                    {realisedDiff <= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> : <TrendingDown className="h-3.5 w-3.5 text-amber-600" />}
                                    {realisedDiff <= 0 ? "Realised FX Gain (7-2000):" : "Realised FX Loss (8-3000):"}
                                </span>
                                <span className="font-bold font-money text-sm">
                                    {realisedDiff <= 0 ? "+" : "-"}{formatIDR(Math.abs(realisedDiff))}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-1.5">
                        <Label htmlFor="account" className="text-xs font-medium">Pay From (Cash / Bank Account)</Label>
                        <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                            <SelectTrigger id="account" className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Select Bank / Cash Account" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                        <div className="flex items-center">
                                            {acc.name.toLowerCase().includes("cash") || acc.code === "1-1101" ? (
                                                <Wallet className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                            ) : (
                                                <CreditCard className="w-3.5 h-3.5 mr-2 text-blue-500" />
                                            )}
                                            <span>{acc.code} - {acc.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="amount" className="text-xs font-medium">
                                Payment Amount ({currency})
                            </Label>
                            <Input
                                id="amount"
                                type="number"
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs font-mono font-semibold"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="date" className="text-xs font-medium">Payment Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="h-8 text-xs font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="method" className="text-xs font-medium">Payment Method</Label>
                            <Select value={paymentMethod.toString()} onValueChange={(v) => setPaymentMethod(parseInt(v))}>
                                <SelectTrigger id="method" className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Bank Transfer</SelectItem>
                                    <SelectItem value="0">Cash</SelectItem>
                                    <SelectItem value="2">Check / Giro</SelectItem>
                                    <SelectItem value="3">Credit Card</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="ref" className="text-xs font-medium">Reference #</Label>
                            <Input
                                id="ref"
                                placeholder="e.g. TRF-8812"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="h-8 text-xs font-mono"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting} size="sm" className="text-xs">
                        Cancel
                    </Button>
                    <Button
                        onClick={handlePay}
                        disabled={isSubmitting}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Posting...
                            </>
                        ) : (
                            "Confirm & Post Payment"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
