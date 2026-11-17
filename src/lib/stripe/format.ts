export function formatStripeAmount(amountTotal: number, currency: string, locale = "es-PE") {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() });
  const minorUnitScale = 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
  return formatter.format(amountTotal / minorUnitScale);
}
