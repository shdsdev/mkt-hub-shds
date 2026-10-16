import jsPDF from "jspdf";

export type QuestionExportRow = {
  createdAt: Date;
  status: string;
  question: string;
  answer: string | null;
  votes: number;
  topic: string | null;
  fullName: string;
  company: string;
};

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildQuestionsCsv(rows: QuestionExportRow[], includeIdentity: boolean): string {
  const header = ["fecha", "estado", "pregunta", "respuesta", "votos", "tema", ...(includeIdentity ? ["nombre", "empresa"] : [])];
  const lines = rows.map((row) => {
    const values = [
      row.createdAt.toISOString(),
      row.status,
      row.question,
      row.answer ?? "",
      String(row.votes),
      row.topic ?? "",
      ...(includeIdentity ? [row.fullName, row.company] : []),
    ];
    return values.map(escapeCsvField).join(",");
  });
  return [header.join(","), ...lines].map((line) => `${line}\r\n`).join("");
}

export function buildQuestionsPdf(rows: QuestionExportRow[], includeIdentity: boolean): Buffer {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;
  pdf.setFontSize(16);
  pdf.text("Preguntas del evento", 40, y);
  y += 28;
  pdf.setFontSize(10);

  for (const row of rows) {
    const identity = includeIdentity ? `\n${row.fullName} · ${row.company}` : "";
    const content = `${row.question}\nRespuesta: ${row.answer ?? "Sin respuesta"}\nVotos: ${row.votes} · Estado: ${row.status}${identity}`;
    const lines = pdf.splitTextToSize(content, 515) as string[];
    if (y + lines.length * 14 > 780) {
      pdf.addPage();
      y = 48;
    }
    pdf.text(lines, 40, y);
    y += lines.length * 14 + 16;
  }

  return Buffer.from(pdf.output("arraybuffer"));
}
