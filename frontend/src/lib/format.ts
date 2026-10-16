/**
 * Format utilities for currency and date display
 */

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currency - Currency code (default: IDR)
 * @param locale - Locale for formatting (default: id-ID)
 */
export function formatCurrency(
    amount: number,
    currency: string = 'IDR',
    locale: string = 'id-ID'
): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format a date string to localized format
 * @param dateString - ISO date string or Date object
 * @param options - Intl.DateTimeFormatOptions
 * @param locale - Locale for formatting (default: id-ID)
 */
export function formatDate(
    dateString: string | Date,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    },
    locale: string = 'id-ID'
): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Format a date to short format (e.g., "01 Feb 2026")
 */
export function formatDateShort(dateString: string | Date, locale: string = 'id-ID'): string {
    return formatDate(dateString, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }, locale);
}

/**
 * Format a date to ISO format (YYYY-MM-DD)
 */
export function formatDateISO(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toISOString().split('T')[0];
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(
    value: number,
    locale: string = 'id-ID',
    options: Intl.NumberFormatOptions = {}
): string {
    return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format a percentage
 */
export function formatPercent(
    value: number,
    decimals: number = 0,
    locale: string = 'id-ID'
): string {
    return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value / 100);
}
