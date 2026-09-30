export function cleanFirestoreData(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => cleanFirestoreData(item))
      .filter((item) => item !== undefined);
    return cleaned;
  }

  if (typeof value === "object") {
    const cleaned = {};
    Object.entries(value).forEach(([key, val]) => {
      const nextVal = cleanFirestoreData(val);
      if (nextVal !== undefined) cleaned[key] = nextVal;
    });
    return cleaned;
  }

  return value;
}

