interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, readonly string[]>;
}

declare global {
  interface Window {
    showOpenFilePicker: (options?: {
      types?: readonly FilePickerAcceptType[];
      excludeAcceptAllOption?: boolean;
      multiple?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker: (options?: {
      suggestedName?: string;
      types?: readonly FilePickerAcceptType[];
    }) => Promise<FileSystemFileHandle>;
  }
}

let savedHandle: FileSystemFileHandle | null = null;

const QBANK_TYPE = { description: "Question Bank Document", accept: { "application/json": [".qbank"] } } as const;

function hasFSA(): boolean {
  return "showOpenFilePicker" in window;
}

export async function openFileFromDisk(): Promise<{ name: string; content: string } | null> {
  try {
    if (hasFSA()) {
      const [handle] = await window.showOpenFilePicker({
        types: [QBANK_TYPE],
        excludeAcceptAllOption: true,
      });
      savedHandle = handle;
      const file = await handle.getFile();
      return { name: file.name, content: await file.text() };
    }
    return await openFileViaInput();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

function openFileViaInput(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".qbank";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      savedHandle = null;
      resolve({ name: file.name, content: await file.text() });
    };
    input.click();
  });
}

export async function saveFileToDisk(title: string, content: string): Promise<string | null> {
  const blob = new Blob([content], { type: "application/json" });

  if (savedHandle) {
    try {
      const writable = await savedHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return (await savedHandle.getFile()).name;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
    }
  }

  if (hasFSA()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${title}.qbank`,
        types: [QBANK_TYPE],
      });
      savedHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return (await handle.getFile()).name;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      throw err;
    }
  }

  downloadBlob(blob, `${title}.qbank`);
  return `${title}.qbank`;
}

export async function saveAsFileToDisk(title: string, content: string): Promise<string | null> {
  const blob = new Blob([content], { type: "application/json" });

  if (hasFSA()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${title}.qbank`,
        types: [QBANK_TYPE],
      });
      savedHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return (await handle.getFile()).name;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      throw err;
    }
  }

  downloadBlob(blob, `${title}.qbank`);
  return `${title}.qbank`;
}

export function clearSavedHandle(): void {
  savedHandle = null;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
