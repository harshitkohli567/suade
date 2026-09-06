/**
 * Renders a Skill run's working-notes channel (markdown-ish text:
 * headings, bullets, numbered lists, tables, bold/italic/code) into a
 * formatted .docx, returned as base64 for the task pane to open via
 * Office.js Application.createDocument. Pure JS (docx package) -- no
 * native deps, runs on Render as-is.
 *
 * Covers the structures Skills actually emit in their Output Packages;
 * unknown markdown falls through as plain paragraphs, so nothing is
 * dropped. Images are out of scope.
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  ExternalHyperlink,
} = require("docx");
const JSZip = require("jszip");

const NUMBERING_REF = "working-notes-numbered";

const MD_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

// House formatting for every Suade deliverable: black Times New Roman 12pt,
// justified body; titles and headings bold (left-aligned so bold headings
// don't get stretched by justification). Sizes are in half-points.
const BASE_FONT = "Times New Roman";
const BASE_SIZE = 24; // 12pt
const BLACK = "000000";

function baseStyles() {
  return {
    default: {
      document: {
        run: { font: BASE_FONT, size: BASE_SIZE, color: BLACK },
        paragraph: { alignment: AlignmentType.JUSTIFIED },
      },
      title: {
        run: { font: BASE_FONT, size: 36, bold: true, color: BLACK },
        paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 120 } },
      },
      heading1: {
        run: { font: BASE_FONT, size: 30, bold: true, color: BLACK },
        paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 240, after: 120 } },
      },
      heading2: {
        run: { font: BASE_FONT, size: 26, bold: true, color: BLACK },
        paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 200, after: 100 } },
      },
      heading3: {
        run: { font: BASE_FONT, size: 24, bold: true, color: BLACK },
        paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 160, after: 80 } },
      },
      // Citation links stay live but render in black (a filed pleading is
      // all-black ink), still underlined so they read as links.
      hyperlink: {
        run: { font: BASE_FONT, size: BASE_SIZE, color: BLACK, underline: { type: "single" } },
      },
    },
  };
}

function numberingConfig() {
  return {
    config: [
      {
        reference: NUMBERING_REF,
        levels: [
          {
            level: 0,
            format: "decimal",
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  };
}

/**
 * `[text](url)` -> real Word hyperlinks; `**bold**`, `*italic*`, and
 * `code` spans -> styled TextRuns. runOptions (size, bold) apply to every
 * run so table cells can reuse this at their smaller font.
 */
function parseInlineRuns(text, runOptions = {}) {
  const runs = [];

  const pushPlainSegment = (segment) => {
    const tokenRe = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let match;
    while ((match = tokenRe.exec(segment))) {
      if (match.index > last) {
        runs.push(new TextRun({ ...runOptions, text: segment.slice(last, match.index) }));
      }
      const token = match[0];
      if (token.startsWith("**")) {
        runs.push(new TextRun({ ...runOptions, text: token.slice(2, -2), bold: true }));
      } else if (token.startsWith("`")) {
        runs.push(new TextRun({ ...runOptions, text: token.slice(1, -1), font: "Consolas" }));
      } else {
        runs.push(new TextRun({ ...runOptions, text: token.slice(1, -1), italics: true }));
      }
      last = match.index + token.length;
    }
    if (last < segment.length) {
      runs.push(new TextRun({ ...runOptions, text: segment.slice(last) }));
    }
  };

  let last = 0;
  let match;
  const linkRe = new RegExp(MD_LINK_RE.source, "g");
  while ((match = linkRe.exec(text))) {
    if (match.index > last) {
      pushPlainSegment(text.slice(last, match.index));
    }
    runs.push(
      new ExternalHyperlink({
        link: match[2],
        children: [
          new TextRun({
            ...runOptions,
            text: match[1].replace(/\*\*/g, "").replace(/`/g, ""),
            style: "Hyperlink",
          }),
        ],
      })
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    pushPlainSegment(text.slice(last));
  }

  return runs.length > 0 ? runs : [new TextRun({ ...runOptions, text: "" })];
}

const HEADING_LEVELS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const SEPARATOR_CELL_RE = /^:?-{3,}:?$/;

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Markdown pipe table -> Word table. A |---|---| separator as the second
 * row marks the first row as a shaded, bold header. Cells use a slightly
 * smaller font so the wide matrices Skills emit (10+ columns of Y/N)
 * stay on the page.
 */
function buildTable(tableLines) {
  const rawRows = tableLines.map(splitTableRow);

  let headerCells = null;
  let bodyRows = rawRows;
  if (rawRows.length >= 2 && rawRows[1].length > 0 && rawRows[1].every((c) => SEPARATOR_CELL_RE.test(c))) {
    headerCells = rawRows[0];
    bodyRows = rawRows.slice(2);
  }

  const columnCount = Math.max(...rawRows.map((r) => r.length));
  const pad = (cells) => [...cells, ...Array(Math.max(0, columnCount - cells.length)).fill("")];

  const makeCell = (text, isHeader) =>
    new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      shading: isHeader ? { fill: "EEF1F5" } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          // 9pt keeps wide matrices readable; citation links inside cells stay live.
          children: parseInlineRuns(text, { size: 18, bold: isHeader }),
        }),
      ],
    });

  const rows = [];
  if (headerCells) {
    rows.push(new TableRow({ tableHeader: true, children: pad(headerCells).map((c) => makeCell(c, true)) }));
  }
  for (const cells of bodyRows) {
    rows.push(new TableRow({ children: pad(cells).map((c) => makeCell(c, false)) }));
  }

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function markdownToParagraphs(markdown) {
  const paragraphs = [];
  let buffer = [];
  // Each contiguous numbered list gets its own numbering instance so
  // numbering restarts at 1 instead of continuing across lists.
  let listInstance = 0;
  let inNumberedList = false;

  let tableLines = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    paragraphs.push(new Paragraph({ children: parseInlineRuns(buffer.join(" ")), spacing: { after: 120 } }));
    buffer = [];
  };

  const flushTable = () => {
    if (tableLines.length === 0) return;
    paragraphs.push(buildTable(tableLines));
    paragraphs.push(new Paragraph({ children: [], spacing: { after: 60 } })); // breathing room after the table
    tableLines = [];
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();

    if (TABLE_ROW_RE.test(line)) {
      flushBuffer();
      tableLines.push(line);
      continue;
    }
    flushTable();

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const numberedMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (!numberedMatch && line.trim() !== "") {
      inNumberedList = false;
    }

    if (headingMatch) {
      flushBuffer();
      const level = Math.min(headingMatch[1].length, HEADING_LEVELS.length) - 1;
      paragraphs.push(
        new Paragraph({
          heading: HEADING_LEVELS[level],
          children: parseInlineRuns(headingMatch[2].trim()),
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (bulletMatch) {
      flushBuffer();
      paragraphs.push(
        new Paragraph({ children: parseInlineRuns(bulletMatch[1]), bullet: { level: 0 }, spacing: { after: 60 } })
      );
    } else if (numberedMatch) {
      flushBuffer();
      if (!inNumberedList) {
        listInstance++;
        inNumberedList = true;
      }
      paragraphs.push(
        new Paragraph({
          children: parseInlineRuns(numberedMatch[1]),
          numbering: { reference: NUMBERING_REF, level: 0, instance: listInstance },
          spacing: { after: 60 },
        })
      );
    } else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
      flushBuffer(); // horizontal rule -- treat as a paragraph break
    } else if (line.trim() === "") {
      flushBuffer();
    } else {
      buffer.push(line.trim());
    }
  }
  flushTable();
  flushBuffer();

  return paragraphs;
}

async function buildWorkingNotesDocx({ skillDisplayName, matterId, notesMarkdown }) {
  const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`${skillDisplayName} — Working Notes`)],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Matter: ${matterId || "(no matter resolved)"}  ·  Generated by Suade, ${generatedAt}`,
          italics: true,
        }),
      ],
      spacing: { after: 240 },
    }),
    ...markdownToParagraphs(notesMarkdown),
  ];

  const doc = new Document({
    styles: baseStyles(),
    numbering: numberingConfig(),
    sections: [{ children }],
  });

  return Packer.toBase64String(doc);
}

// Tag prefix MUST match the add-in's EDIT_PAIR_TAG_PREFIX (insertContent.ts):
// the add-in's edit-rationale watcher adopts any content control whose tag
// starts with this and captures the lawyer's edits to it. Keeping it in sync
// is what makes a downloaded draft "light up" the yes/no rationale flow.
const EDIT_PAIR_TAG_PREFIX = "suade-ep-";

/**
 * Wraps each drafted section's body paragraphs in a hidden Word content
 * control (SDT) tagged `suade-ep-<id>`, by post-processing the packed .docx
 * XML (the docx library has no content-control support). When the file is
 * opened in Word with the Suade add-in, its watcher enumerates these controls,
 * adopts each as a tracked draft (baseline = its current text), and fires the
 * edit-rationale yes/no question on the lawyer's first edit to that section.
 *
 * The transform is deterministic because we own the document's shape: a Title,
 * a meta line, then repeating [Heading1 label, body paragraphs]. We wrap only
 * each section's body (the heading stays outside), so the tracked text is the
 * section draft itself. If the XML doesn't reconstruct exactly, we bail and
 * return the file unchanged rather than risk corrupting it.
 */
async function embedSectionContentControls(base64Docx) {
  const zip = await JSZip.loadAsync(Buffer.from(base64Docx, "base64"));
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) return base64Docx;
  let xml = await docXmlFile.async("string");

  // The hidden-appearance element lives in the w15 namespace; declare it if
  // the packer didn't (Word falls back to a visible box otherwise, but the
  // control still works).
  if (!/xmlns:w15=/.test(xml)) {
    xml = xml.replace(
      /<w:document\b/,
      '<w:document xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"'
    );
  }
  // Mark w15 ignorable so a strict parser (or pre-2013 Word) treats the doc as
  // valid and just skips the appearance hint, rather than rejecting/repairing.
  const mcMatch = xml.match(/mc:Ignorable="([^"]*)"/);
  if (mcMatch && !/\bw15\b/.test(mcMatch[1])) {
    xml = xml.replace(/mc:Ignorable="([^"]*)"/, `mc:Ignorable="$1 w15"`);
  }

  const bodyOpen = xml.indexOf("<w:body>");
  const bodyClose = xml.lastIndexOf("</w:body>");
  if (bodyOpen === -1 || bodyClose === -1) return base64Docx;

  const head = xml.slice(0, bodyOpen + "<w:body>".length);
  const tail = xml.slice(bodyClose);
  let inner = xml.slice(bodyOpen + "<w:body>".length, bodyClose);

  // Keep the trailing section properties (page setup) at the body's end.
  let sectPr = "";
  const sectPrMatch = inner.match(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*$/);
  if (sectPrMatch) {
    sectPr = sectPrMatch[0];
    inner = inner.slice(0, inner.length - sectPr.length);
  }

  // Split into top-level block elements. The draft is paragraphs only; the
  // reconstruction guard below aborts if anything unexpected appears.
  const blocks = inner.match(/<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) || [];
  if (blocks.join("") !== inner) return base64Docx; // structure surprise -> don't touch it

  const isHeading1 = (p) => /<w:pStyle w:val="Heading1"\s*\/>/.test(p);
  const sdtWrap = (tag, contentXml) => {
    const id = 100000000 + Math.floor(Math.random() * 899999999);
    return (
      `<w:sdt><w:sdtPr><w:alias w:val="Suade draft"/><w:tag w:val="${tag}"/>` +
      `<w:id w:val="${id}"/><w15:appearance w15:val="hidden"/></w:sdtPr>` +
      `<w:sdtEndPr/><w:sdtContent>${contentXml}</w:sdtContent></w:sdt>`
    );
  };

  const out = [];
  let i = 0;
  let section = 0;
  const stamp = Date.now().toString(36);
  while (i < blocks.length) {
    if (isHeading1(blocks[i])) {
      out.push(blocks[i]); // heading stays outside the control
      i++;
      const body = [];
      while (i < blocks.length && !isHeading1(blocks[i])) {
        body.push(blocks[i]);
        i++;
      }
      // editPairId must match the server's ^ep-[A-Za-z0-9-]{6,64}$ (it validates
      // it on /api/edit-rationale/predict); the tag is prefix + that id, so real
      // Suade tags read "suade-ep-ep-...". We mirror that shape here.
      if (body.length) out.push(sdtWrap(`${EDIT_PAIR_TAG_PREFIX}ep-web-${stamp}-${section}`, body.join("")));
      section++;
    } else {
      out.push(blocks[i]); // title / meta paragraphs
      i++;
    }
  }
  if (section === 0) return base64Docx; // no sections detected -> leave as-is

  zip.file("word/document.xml", head + out.join("") + sectPr + tail);
  return zip.generateAsync({ type: "base64" });
}

/**
 * Renders the clean draft (the filing text) into a .docx with the same house
 * formatting. The clean draft is plain text whose only markup is citation
 * links, so each non-empty line becomes its own justified paragraph (this
 * preserves the pleading's own clause numbering as literal text rather than
 * re-numbering it as a Word list). Section labels become bold headings.
 *
 * Each section's body is wrapped in a hidden Suade content control so the
 * add-in's edit-rationale watcher tracks edits to the downloaded draft.
 */
async function buildDraftDocx({ documentTypeLabel, matterId, draftSections }) {
  const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(documentTypeLabel)],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Matter: ${matterId || "(no matter resolved)"}  ·  Draft generated by Suade, ${generatedAt}`,
          italics: true,
        }),
      ],
      spacing: { after: 240 },
    }),
  ];

  for (const section of draftSections || []) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: parseInlineRuns(section.label),
      })
    );
    for (const rawLine of String(section.text || "").split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      children.push(new Paragraph({ children: parseInlineRuns(line), spacing: { after: 120 } }));
    }
  }

  const doc = new Document({
    styles: baseStyles(),
    numbering: numberingConfig(),
    sections: [{ children }],
  });

  const base64 = await Packer.toBase64String(doc);
  try {
    return await embedSectionContentControls(base64);
  } catch (err) {
    // Never fail the download over the tracking wrapper; a plain draft still
    // opens fine, it just won't auto-track edits.
    console.error("Suade draft content-control embedding failed:", err);
    return base64;
  }
}

module.exports = { buildWorkingNotesDocx, buildDraftDocx };
