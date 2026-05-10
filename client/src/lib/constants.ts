export const LS_UPLOADED_FILES = "paperpilot.sources.v1";
export const LS_ACTIVE_FILE_IDS = "paperpilot.activeSources.v1";

export const APP_NAME = "PaperPilot";
export const APP_TAGLINE = "Navigate your documents with AI";

export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".csv", ".docx"] as const;
export const ACCEPTED_LABEL = "PDF, TXT, CSV, or DOCX";
export const MAX_UPLOAD_MB = 32;

export const QUICK_PROMPTS: { id: string; label: string; prompt: string }[] = [
  {
    id: "summary",
    label: "Summarize the selected sources",
    prompt:
      "Give me a concise, well-structured summary of the selected documents. Use short sections with headings where useful.",
  },
  {
    id: "topics",
    label: "Extract the main topics",
    prompt:
      "List the main topics covered in the selected documents as a bullet list. For each topic, add a one-line description grounded in the source.",
  },
  {
    id: "study",
    label: "Generate a study guide",
    prompt:
      "Create a study guide from the selected documents. Include key terms with definitions, important takeaways, and a few review questions.",
  },
  {
    id: "faq",
    label: "Build a FAQ",
    prompt:
      "Generate 5–8 frequently asked questions a reader might have about the selected documents, and answer each one using only the source material.",
  },
  {
    id: "timeline",
    label: "Highlight a timeline / key dates",
    prompt:
      "If the selected documents reference dates or a sequence of events, list them in chronological order with a brief description of each.",
  },
];

export const SAMPLE_QUESTIONS: string[] = [
  "What are the three most important takeaways?",
  "Explain this document like I'm new to the topic.",
  "What evidence is given to support the main claim?",
  "Are there any contradictions between the sources?",
];
