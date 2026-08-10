import { HDate, HebrewCalendar } from '@hebcal/core';

// Shabbat parsha names and Rosh Chodesh aren't "holidays" in the sense the
// household cares about marking on a debt/expense calendar - everything else
// (major/minor holidays, fasts, chol ha'moed, modern Israeli days) is kept.
const EXCLUDED_CATEGORIES = ['shabbat', 'roshchodesh'];

export function hebrewDateString(dateISO) {
  const hd = new HDate(new Date(`${dateISO}T00:00:00`));
  return hd.renderGematriya(true);
}

const yearCache = new Map();

function holidaysByDateForYear(year) {
  if (yearCache.has(year)) return yearCache.get(year);
  const events = HebrewCalendar.calendar({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
    il: true,
  });
  const map = {};
  for (const ev of events) {
    const categories = ev.getCategories();
    if (categories.some((c) => EXCLUDED_CATEGORIES.includes(c))) continue;
    const dateISO = ev.getDate().greg().toISOString().slice(0, 10);
    (map[dateISO] ||= []).push({ title: ev.render('he-x-NoNikud'), categories });
  }
  yearCache.set(year, map);
  return map;
}

export function holidaysForDate(dateISO) {
  const year = Number(dateISO.slice(0, 4));
  const list = holidaysByDateForYear(year)[dateISO] || [];
  if (dateISO.slice(5) === '01-01') {
    return [...list, { title: 'ראש השנה האזרחית', categories: ['civil'] }];
  }
  return list;
}

export function hasHoliday(dateISO) {
  return holidaysForDate(dateISO).length > 0;
}
