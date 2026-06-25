import type { ApiAnalyticsResponse, ApiRestaurant } from './api';
import type { MonthlyReportData, RestaurantPrintMeta, SalesReportData } from './PrintService';
import { getRestaurantLogo } from './restaurantLogoStorage';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import { reportPeriodCaption } from '../utils/analyticsPeriod';

function restaurantMeta(r: ApiRestaurant): RestaurantPrintMeta {
  const parts = [r.address_line1, r.city, r.country].filter(Boolean);
  return {
    restaurantName: r.name,
    currencySymbol: getCurrencySymbol(r.currency_code),
    logoUrl: getRestaurantLogo(r.id, r.logo_url),
    addressLine: parts.join(', ') || undefined,
    phone: r.contact_phone || undefined,
    taxId: r.tax_id || undefined,
    email: r.contact_email || undefined,
  };
}

function shortDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Sales summary — KPIs, top items, and category breakdown for the selected period. */
export function buildSalesReportFromAnalytics(
  data: ApiAnalyticsResponse,
  restaurant: ApiRestaurant,
  catLabels: Map<string, string>,
): SalesReportData {
  const meta = restaurantMeta(restaurant);
  const { revenue, totalQty, tables_total, tables_occupied, deltas } = data;
  const totalRev = revenue.totalRevenue;
  const totalOrders = revenue.totalOrders;
  const avg = totalOrders ? totalRev / totalOrders : 0;
  const occ = tables_total ? Math.round((tables_occupied / tables_total) * 100) : 0;

  const peakHour = data.hours.reduce(
    (best, h) => (h.covers > best.covers ? h : best),
    { hour: 0, label: '—', covers: 0 },
  );

  const metrics = [
    { label: 'Gross revenue', value: formatMoney(totalRev, restaurant.currency_code) },
    { label: 'Paid orders', value: String(totalOrders) },
    { label: 'Items sold', value: String(totalQty) },
    { label: 'Avg order', value: formatMoney(avg, restaurant.currency_code) },
    { label: 'Revenue vs prior', value: `${deltas.revenuePct >= 0 ? '+' : ''}${deltas.revenuePct}%` },
    { label: 'Tables now', value: `${tables_occupied}/${tables_total} (${occ}%)` },
    { label: 'Peak hour', value: peakHour.covers > 0 ? `${peakHour.label} (${peakHour.covers})` : '—' },
  ];

  const itemRows = data.topItems.slice(0, 10).map(it => ({
    label: it.item_name,
    orders: it.qty_sold,
    revenue: it.revenue,
  }));

  const catRows = data.categories.slice(0, 8).map(c => ({
    label: `Cat: ${catLabels.get(c.category) ?? (c.category || 'Other')}`,
    orders: c.qty_sold,
    revenue: c.revenue,
  }));

  return {
    ...meta,
    title: 'Sales & Analytics Report',
    periodLabel: reportPeriodCaption(data.periodLabel, data.from, data.to),
    metrics,
    rows: [...itemRows, ...catRows],
    totalRevenue: totalRev,
    totalOrders,
  };
}

/** Day-by-day revenue breakdown for multi-day periods. */
export function buildPeriodBreakdownReport(
  data: ApiAnalyticsResponse,
  restaurant: ApiRestaurant,
): MonthlyReportData {
  const meta = restaurantMeta(restaurant);
  const days = data.revenue.rows.map(row => ({
    day: shortDayLabel(row.day),
    orders: row.order_count,
    revenue: row.revenue,
  }));
  const totalRevenue = data.revenue.totalRevenue;
  const totalOrders = data.revenue.totalOrders;
  const dayCount = Math.max(1, data.revenue.dayCount || days.length);

  return {
    ...meta,
    monthLabel: reportPeriodCaption(data.periodLabel, data.from, data.to),
    days,
    totalRevenue,
    totalOrders,
    avgPerDay: totalRevenue / dayCount,
  };
}
