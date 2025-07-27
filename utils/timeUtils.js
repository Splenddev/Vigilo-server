export const toMinutes = (str, classTime) => {
  if (str === 'FULL') {
    const [startH, startM] = classTime.start.split(':').map(Number);
    const [endH, endM] = classTime.end.split(':').map(Number);
    const start = new Date(0, 0, 0, startH, startM);
    const end = new Date(0, 0, 0, endH, endM);
    return Math.floor((end - start) / 60000);
  }

  const match = str.match(/(\d+)H(\d+)M/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
};

export function parseDurationString(str = '0H15M') {
  const hours = parseInt(str.match(/(\d+)H/)?.[1] || '0', 10);
  const minutes = parseInt(str.match(/(\d+)M/)?.[1] || '0', 10);
  return (hours * 60 + minutes) * 60 * 1000;
}
