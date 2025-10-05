const parseEventDateTime = (event) => {
  const rawDate = event.event_date || event.eventDate;
  if (!rawDate) {
    return null;
  }

  let datePart = null;

  if (rawDate instanceof Date) {
    const year = rawDate.getFullYear();
    const month = `${rawDate.getMonth() + 1}`.padStart(2, "0");
    const day = `${rawDate.getDate()}`.padStart(2, "0");
    datePart = `${year}-${month}-${day}`;
  } else if (typeof rawDate === "string") {
    const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
    datePart = match ? match[1] : rawDate;
  }

  if (!datePart) {
    return null;
  }

  const rawTime = event.event_time || event.eventTime;
  let timePart = "00:00:00";

  if (typeof rawTime === "string" && rawTime.trim().length >= 4) {
    const trimmed = rawTime.trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      timePart = trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    }
  }

  const combined = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(combined.getTime()) ? null : combined;
};

const event = {
  event_date: "2025-10-06",
  event_time: "14:06:00",
  status: "Active",
};

const eventDateTime = parseEventDateTime(event);
console.log("eventDateTime", eventDateTime?.toISOString());
console.log("now", new Date().toISOString());
console.log("isCompleted", eventDateTime?.getTime() < Date.now());
