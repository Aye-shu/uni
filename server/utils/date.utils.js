export const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatTime = (time) => {
  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(parseInt(hours));
  date.setMinutes(parseInt(minutes));
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getDayName = (date) => {
  return new Date(date).toLocaleDateString("en-US", { weekday: "long" });
};

export const isToday = (date) => {
  const today = new Date();
  const checkDate = new Date(date);
  return (
    today.getDate() === checkDate.getDate() &&
    today.getMonth() === checkDate.getMonth() &&
    today.getFullYear() === checkDate.getFullYear()
  );
};

export const addMinutes = (time, minutes) => {
  const [hours, mins] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(mins + minutes);
  return date.toTimeString().slice(0, 5);
};

export default { formatDate, formatTime, getDayName, isToday, addMinutes };