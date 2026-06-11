import moment from 'moment'
import { HolidayDate, PerDayOffer } from './supabase'

/**
 * Counts bookable days between two dates, excluding any holiday ranges.
 * Ported from old frontend Rooms.tsx countDaysExcludingHolidays().
 * Now lives server-side so it can't be bypassed.
 */
export function countDaysExcludingHolidays(
  startDate: string,
  endDate: string,
  holidayDates: HolidayDate[]
): number {
  const start = moment(startDate)
  const end = moment(endDate)
  let dayCount = 0

  while (start.isSameOrBefore(end)) {
    const isHoliday = holidayDates.some((holiday) => {
      const holidayStart = moment(holiday.startDate)
      const holidayEnd = moment(holiday.endDate)
      return start.isBetween(holidayStart, holidayEnd, null, '[]')
    })
    if (!isHoliday) dayCount++
    start.add(1, 'days')
  }
  return dayCount
}

/**
 * Finds the applicable per-day offer price for a given date.
 * If no offer matches, returns the listing's base price.
 */
export function getEffectivePrice(
  date: string,
  basePrice: number,
  perDayOffers: PerDayOffer[]
): number {
  const target = moment(date)
  for (const offer of perDayOffers) {
    if (
      target.isSameOrAfter(moment(offer.startDate)) &&
      target.isSameOrBefore(moment(offer.endDate))
    ) {
      return parseFloat(offer.price)
    }
  }
  return basePrice
}

/**
 * Calculates total booking price.
 * Uses the per-day offer price if active on the start date, else base price.
 */
export function calculateBookingTotal(
  startDate: string,
  endDate: string,
  slots: number,
  basePrice: number,
  perDayOffers: PerDayOffer[],
  holidayDates: HolidayDate[]
): { perDayPrice: number; totalDays: number; totalPrice: number } {
  const perDayPrice = getEffectivePrice(startDate, basePrice, perDayOffers)
  const totalDays = countDaysExcludingHolidays(startDate, endDate, holidayDates)
  const totalPrice = perDayPrice * totalDays * slots
  return { perDayPrice, totalDays, totalPrice }
}

export function timeConvert(time: string): string {
  const t = time?.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time]
  if (t.length > 1) {
    const parts = t.slice(1)
    const suffix = +parts[0] < 12 ? ' AM' : ' PM'
    parts[0] = String(+parts[0] % 12 || 12)
    return parts.join('') + suffix
  }
  return time
}
