import type { Editor } from "@tiptap/react";

export interface QuestionRef {
  familyId: string;
  position: number;
}

/** Collect { familyId, position } for every questionBlock in the document. */
export function extractQuestionRefs(editor: Editor): QuestionRef[] {
  const refs: QuestionRef[] = [];
  let position = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "questionBlock") {
      const familyId = node.attrs.family_id as string | undefined;
      if (familyId) refs.push({ familyId, position });
      position += 1;
    }
    return true;
  });
  return refs;
}

/** Unique family ids referenced by questionBlocks in the document. */
export function extractFamilyIds(editor: Editor): string[] {
  const seen = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "questionBlock" && node.attrs.family_id) {
      seen.add(node.attrs.family_id as string);
    }
    return true;
  });
  return [...seen];
}