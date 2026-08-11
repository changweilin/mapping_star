export const downloadText = (
  filename: string,
  content: string,
  type: string
) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadJson = (filename: string, value: unknown) => {
  downloadText(
    filename,
    JSON.stringify(value, null, 2),
    "application/json;charset=utf-8"
  );
};

export const getExportDateStamp = () => new Date().toISOString().slice(0, 10);
