import React, { useMemo } from "react";
import type { LanguagePaperDetail, LanguagePaperQuestion } from "../../api/client";
import type { BilingualQuestionPair, PaperLayoutProps } from "./types";
import { RichTextValue } from "./richTextValue";
import { resolveTemplate } from "./templateConfig";
import {
  buildPairs,
  DEFAULT_INSTRUCTIONS,
  displayOptionsOf,
  languageCode,
  languageName,
  META_LABELS,
  sectionNameOf,
} from "./paperModel";

interface ColumnarPaperProps extends PaperLayoutProps {
  columns: 1 | 2;
}

/**
 * Core rendering engine shared by every registered layout. It sits N resolved
 * language papers side by side using synchronized question pairs: every printed
 * row holds the SAME logical question for each language, so numbers, options,
 * images, math and answer mappings always stay aligned across columns.
 */
export function ColumnarPaper({ left, right, columns, title, instructions, template }: ColumnarPaperProps): React.ReactNode {
  const resolved = useMemo(() => resolveTemplate(template), [template]);
  const pairs = useMemo(() => buildPairs(left, columns === 2 ? right : undefined), [left, right, columns]);
  const documentTitle = title ?? resolved.header.examTitle ?? left.paper.title ?? "Question Paper";
  const leftLangName = languageName(left);
  const rightLangName = languageName(right);
  const leftLangCode = languageCode(left);
  const rightLangCode = languageCode(right);

  const instituteName = resolved.header.instituteName ?? resolved.branding.instituteName;
  const brandLine = [resolved.branding.batch, resolved.branding.academicYear].filter(Boolean).join(" · ");

  const showInstructions = resolved.instructions.show;
  const leftInstructions =
    resolved.instructions.left ?? instructions?.left ?? DEFAULT_INSTRUCTIONS[leftLangCode] ?? DEFAULT_INSTRUCTIONS.en;
  const rightInstructions =
    resolved.instructions.right ??
    instructions?.right ??
    (columns === 2 ? DEFAULT_INSTRUCTIONS[rightLangCode] ?? DEFAULT_INSTRUCTIONS.en : undefined);

  let previousSection: string | null | undefined;
  const rows: React.ReactNode[] = [];

  for (const pair of pairs) {
    const sectionKey = pair.sectionKey;
    if (sectionKey !== previousSection) {
      rows.push(
        <SectionDivider
          key={`section-${String(sectionKey ?? "__default__")}`}
          left={left}
          right={right}
          columns={columns}
          sectionKey={sectionKey}
        />
      );
      previousSection = sectionKey;
    }
    rows.push(
      <PairRow
        key={`pair-${pair.number}`}
        pair={pair}
        columns={columns}
        leftLangCode={leftLangCode}
        rightLangCode={rightLangCode}
        leftLangName={leftLangName}
        rightLangName={rightLangName}
      />
    );
  }

  return (
    <div className="print-paper-page bilingual-page">
      <div className="bilingual-fixed-header" data-bilingual-header>
        <div className="bilingual-header">
          {resolved.header.showLogo && resolved.header.logoDataUrl && (
            <img
              className="bilingual-logo"
              src={resolved.header.logoDataUrl}
              alt={instituteName ?? "Institute logo"}
              style={{ width: resolved.header.logoWidthPx }}
            />
          )}
          {instituteName && <div className="bilingual-header-institute">{instituteName}</div>}
          <div className="bilingual-header-title">{documentTitle}</div>
          <div className="bilingual-header-subtitle">
            {columns === 2 ? `${leftLangName} & ${rightLangName} — Bilingual Question Paper` : `${leftLangName} Question Paper`}
          </div>
          {brandLine && <div className="bilingual-header-brand-line">{brandLine}</div>}
          {resolved.header.showMeta && (
            <div className="bilingual-header-meta bilingual-grid">
              <div className="bilingual-col meta-col" data-lang={leftLangCode}>
                <MetaLines detail={left} />
              </div>
              {columns === 2 && right && (
                <div className="bilingual-col meta-col" data-lang={rightLangCode}>
                  <MetaLines detail={right} />
                </div>
              )}
            </div>
          )}
        </div>
        {showInstructions && (
          <InstructionBox
            leftInstructions={leftInstructions}
            rightInstructions={columns === 2 ? rightInstructions : undefined}
            leftLangCode={leftLangCode}
            rightLangCode={rightLangCode}
            columns={columns}
          />
        )}
      </div>

      <div className="print-document-body">{rows}</div>
    </div>
  );
}

function MetaLines({ detail }: { detail: LanguagePaperDetail }): React.ReactNode {
  const code = languageCode(detail);
  const labels = META_LABELS[code] ?? META_LABELS.en;
  const minutes = Number(detail.paper?.duration_min) || 0;
  const marks = Number(detail.paper?.total_marks) || 0;
  const metaLines = [
    `${labels.subject}: ${detail.paper?.title ?? "—"}`,
    `${labels.time}: ${minutes > 0 ? `${minutes} Minutes` : "—"}`,
    `${labels.marks}: ${marks > 0 ? marks : "—"}`,
  ];
  return (
    <>
      {metaLines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </>
  );
}

function InstructionBox({
  leftInstructions,
  rightInstructions,
  leftLangCode,
  rightLangCode,
  columns,
}: {
  leftInstructions: string[];
  rightInstructions?: string[];
  leftLangCode: string;
  rightLangCode?: string;
  columns: 1 | 2;
}): React.ReactNode {
  return (
    <div className="bilingual-instructions bilingual-grid">
      <div className="bilingual-col" data-lang={leftLangCode}>
        <ol>
          {leftInstructions.map((inst, i) => (
            <li key={`l-${i}`}>{inst}</li>
          ))}
        </ol>
      </div>
      {columns === 2 && rightInstructions && (
        <div className="bilingual-col" data-lang={rightLangCode}>
          <ol>
            {rightInstructions.map((inst, i) => (
              <li key={`r-${i}`}>{inst}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function SectionDivider({
  left,
  right,
  columns,
  sectionKey,
}: {
  left: LanguagePaperDetail;
  right?: LanguagePaperDetail;
  columns: 1 | 2;
  sectionKey: string | null;
}): React.ReactNode {
  const leftName = sectionNameOf(left, sectionKey);
  const rightName = columns === 2 ? sectionNameOf(right, sectionKey) : undefined;
  const leftInstruction = sectionInstruction(left, sectionKey);
  const rightInstruction = columns === 2 ? sectionInstruction(right, sectionKey) : undefined;

  return (
    <div className="bilingual-section-divider">
      <div className="bilingual-section-bar">
        <span className="bilingual-section-name" data-lang={languageCode(left)}>
          {leftName}
        </span>
        {columns === 2 && right && (
          <span className="bilingual-section-name" data-lang={languageCode(right)}>
            {rightName}
          </span>
        )}
      </div>
      {(leftInstruction || rightInstruction) && (
        <div className="bilingual-section-instructions bilingual-grid">
          <div className="bilingual-col" data-lang={languageCode(left)}>
            <RichTextValue value={leftInstruction} lang={languageCode(left)} />
          </div>
          {columns === 2 && right && (
            <div className="bilingual-col" data-lang={languageCode(right)}>
              <RichTextValue value={rightInstruction} lang={languageCode(right)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function sectionInstruction(detail: LanguagePaperDetail | undefined, key: string | null): string | undefined {
  if (!key || !detail) return undefined;
  const instructions = detail.sectionInstructions;
  if (!instructions || typeof instructions !== "object") return undefined;
  return instructions[key];
}

function PairRow({
  pair,
  columns,
  leftLangCode,
  rightLangCode,
  leftLangName,
  rightLangName,
}: {
  pair: BilingualQuestionPair;
  columns: 1 | 2;
  leftLangCode: string;
  rightLangCode: string;
  leftLangName: string;
  rightLangName: string;
}): React.ReactNode {
  if (columns === 2) {
    return (
      <div className="bilingual-question-pair" data-pair={pair.number}>
        <div className="bilingual-col" data-lang={leftLangCode}>
          <QuestionCell pair={pair} langCode={leftLangCode} langName={leftLangName} side="left" />
        </div>
        <div className="bilingual-col" data-lang={rightLangCode}>
          <QuestionCell pair={pair} langCode={rightLangCode} langName={rightLangName} side="right" />
        </div>
      </div>
    );
  }

  return (
    <div className="bilingual-question-pair single-col" data-pair={pair.number}>
      <div className="bilingual-col" data-lang={leftLangCode}>
        <QuestionCell pair={pair} langCode={leftLangCode} langName={leftLangName} side="left" />
      </div>
    </div>
  );
}

function QuestionCell({
  pair,
  langCode,
  langName,
  side,
}: {
  pair: BilingualQuestionPair;
  langCode: string;
  langName: string;
  side: "left" | "right";
}): React.ReactNode {
  const q: LanguagePaperQuestion | null = side === "left" ? pair.left : pair.right;
  const marks = pair.marks > 0 ? pair.marks : q?.marks ?? 0;
  const negativeMarks = pair.negativeMarks > 0 ? pair.negativeMarks : q?.negative_marks ?? 0;
  const options = displayOptionsOf(q);

  return (
    <div className="bilingual-question">
      <div className="bilingual-question-top">
        <span className="bilingual-question-number">Q{pair.number}.</span>
        {marks > 0 && (
          <span className="bilingual-question-marks">
            [{marks} marks{negativeMarks > 0 ? ` · -${negativeMarks} negative` : ""}]
          </span>
        )}
      </div>

      {q?.question ? (
        <>
          <div className="bilingual-question-body">
            <RichTextValue value={q.question.content} lang={langCode} />
          </div>
          {options.length > 0 && (
            <div className="bilingual-options">
              {options.map((opt, i) => (
                <div key={i} className="bilingual-option">
                  <span className="bilingual-option-label">({opt.label})</span>
                  <span className="bilingual-option-content">
                    <RichTextValue value={opt.content} lang={langCode} />
                  </span>
                </div>
              ))}
            </div>
          )}
          {q.substituted && (
            <div className="bilingual-note">Content substituted from another language — translator attention required.</div>
          )}
          {q.invariant_issues.length > 0 && (
            <div className="bilingual-note warn">
              {q.invariant_issues.length} invariant issue(s): {q.invariant_issues.map((iss) => iss.field).join(", ")}
            </div>
          )}
        </>
      ) : (
        <div className="bilingual-missing">{langName} version of this question is not available.</div>
      )}
    </div>
  );
}