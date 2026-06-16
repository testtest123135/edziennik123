import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export type ParsedFile = {
  name: string;
  text: string;
  type: "document" | "image";
};

const MAX_TEXT_LENGTH = 30000;

function truncate(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH) + `\n\n[...plik skrócony, łącznie ${text.length} znaków]`;
}

async function parsePdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str ?? "").join(" ");
    if (text.trim()) pages.push(`--- Strona ${i} ---\n${text}`);
  }
  return pages.join("\n\n") || "(PDF bez tekstu — prawdopodobnie skan)";
}

async function parseDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value || "(pusty dokument)";
}

async function parseCsv(file: File): Promise<string> {
  const text = await file.text();
  return text || "(pusty plik CSV)";
}

async function parseTxt(file: File): Promise<string> {
  const text = await file.text();
  return text || "(pusty plik)";
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type;

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return { name: file.name, text: "", type: "image" };
  }

  let text = "";

  try {
    switch (ext) {
      case "pdf":
        text = await parsePdf(file);
        break;
      case "docx":
      case "docm":
        text = await parseDocx(file);
        break;
      case "doc":
        // .doc is legacy binary format — mammoth only handles .docx
        // Try as docx anyway, fall back to raw text
        try {
          text = await parseDocx(file);
        } catch {
          text = await file.text();
          if (!text.trim()) text = "(nie udało się odczytać pliku .doc — użyj formatu .docx)";
        }
        break;
      case "csv":
        text = await parseCsv(file);
        break;
      case "txt":
      case "rtf":
      case "md":
      case "log":
        text = await parseTxt(file);
        break;
      case "xlsx":
      case "xls":
        text = "(plik Excel — konwertuj na CSV lub skopiuj dane jako tekst)";
        break;
      case "odt":
        // ODT is a ZIP with content.xml — try reading as text fallback
        try {
          text = await file.text();
          if (!text.trim() || text.includes("PK")) {
            text = "(format ODT nie jest w pełni obsługiwany — użyj .docx lub .txt)";
          }
        } catch {
          text = "(nie udało się odczytać pliku ODT)";
        }
        break;
      default:
        // Try reading as plain text
        try {
          text = await file.text();
          if (!text.trim()) text = `(nieobsługiwany format .${ext})`;
        } catch {
          text = `(nie udało się odczytać pliku .${ext})`;
        }
    }
  } catch (e: any) {
    text = `(błąd odczytu pliku: ${e.message ?? "nieznany"})`;
  }

  return { name: file.name, text: truncate(text), type: "document" };
}
