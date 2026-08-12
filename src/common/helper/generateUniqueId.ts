export const generateUniqueId = () =>
  `${new Date().toISOString()}-${Math.random().toString(32).substring(2)}`;
