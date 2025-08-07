import axios from 'axios';

export async function getPublicHolidays(
  year = new Date().getFullYear(),
  countryCode = 'NG'
) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;

  try {
    const res = await axios.get(url);
    return res.data.map((holiday) => new Date(holiday.date));
  } catch (err) {
    console.error('Failed to fetch public holidays:', err.message);
    return [];
  }
}
