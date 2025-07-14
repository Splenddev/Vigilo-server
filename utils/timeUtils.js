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
