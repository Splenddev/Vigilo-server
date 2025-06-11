export const generateOtp = () => {
  let result = '';
  const numbers = '0123456789';
  for (let i = 0; i < 6; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return result;
};
