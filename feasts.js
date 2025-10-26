/*
 * ===================================
 * feasts.js
 * * Defines the Biblical feast days based on Karaite reckoning.
 * Each feast has a 'month' (1-12) and a 'day' (day of the month).
 * Some feasts have a 'duration' in days.
 * ===================================
 */

export const FEASTS = [
  // ========== 1st Month (The Month of the Aviv) ==========
  {
    name: "Passover (Pesach)",
    month: 1,
    day: 14,
    description: "The Lord's Passover. (Leviticus 23:5)"
  },
  {
    name: "Feast of Unleavened Bread (Hag HaMatzot) - Day 1",
    month: 1,
    day: 15,
    duration: 7,
    description: "High Sabbath. (Leviticus 23:6-7)"
  },
  {
    name: "Feast of Unleavened Bread (Hag HaMatzot) - Day 7",
    month: 1,
    day: 21,
    description: "High Sabbath. (Leviticus 23:8)"
  },
  {
    name: "Wave Sheaf Offering (Yom HaNef)",
    // This is the "morrow after the Sabbath" *during* Unleavened Bread.
    // We will need special logic for this one, as it's not a fixed date.
    month: 1,
    day: 'morrow_after_weekly_sabbath', 
    description: "Start of the 50-day omer count. (Leviticus 23:10-11, 15)"
  },
  {
    name: "Messiah's Resurrection (Firstfruits)",
    // This aligns with the Wave Sheaf offering.
    month: 1,
    day: 'morrow_after_weekly_sabbath',
    description: "The day Yeshua rose, fulfilling the Wave Sheaf. (1 Corinthians 15:20)"
  },

  // ========== 3rd Month ==========
  {
    name: "Feast of Weeks (Shavuot / Pentecost)",
    // This is 50 days *from* the Wave Sheaf offering.
    // We will need special logic for this one too.
    month: 3, // Usually lands in the 3rd month
    day: '50_days_from_wave_sheaf',
    description: "High Sabbath. 50th day (morrow after the 7th Sabbath). (Leviticus 23:15-16, 21)"
  },

  // ========== 7th Month ==========
  {
    name: "Day of Trumpets (Yom Teruah)",
    month: 7,
    day: 1,
    description: "High Sabbath. (Leviticus 23:24-25)"
  },
  {
    name: "Day of Atonement (Yom Kippur)",
    month: 7,
    day: 10,
    description: "High Sabbath. (Leviticus 23:27-32)"
  },
  {
    name: "Feast of Tabernacles (Sukkot) - Day 1",
    month: 7,
    day: 15,
    duration: 7,
    description: "High Sabbath. (Leviticus 23:34-35)"
  },
  {
    name: "The Eighth Day (Shemini Atzeret)",
    month: 7,
    day: 22,
    description: "High Sabbath. (Leviticus 23:36)"
  }
];