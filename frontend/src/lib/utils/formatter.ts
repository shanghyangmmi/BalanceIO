export const formatCurrency = (amount: number, currency: string = 'IDR'): string => {
    return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'IDR' ? 0 : 2,
        maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount);
};

export const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
    }).format(d);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
    return `${Number(value || 0).toFixed(decimals)}%`;
};

export const parseCurrency = (value: string): number => {
    // Remove non-numeric characters except for possible decimal point
    // Standard IDR doesn't usually use decimals for main display, but just in case
    return Number(value.replace(/[^0-9,-]+/g, ""));
};

export function formatBytes(
    bytes: number,
    decimals = 0,
    sizeType: "accurate" | "normal" = "normal"
) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const accurateSizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"]
    if (bytes === 0) return "0 Byte"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${sizeType === "accurate" ? accurateSizes[i] ?? "Bytest" : sizes[i] ?? "Bytes"
        }`
}
