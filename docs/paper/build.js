const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType,
  WidthType, BorderStyle, SectionType, ShadingType, VerticalAlign, LineRuleType
} = require('docx');

const FIG = '/tmp/claude-0/paper/fig/';
const FONT = 'Times New Roman';
const PAGE = { width: 11906, height: 16838 }; // A4
const MARGIN = { top: 1077, bottom: 1440, left: 812, right: 812 };
const COLGAP = 239;

// ---------- text helpers ----------
// inline markup: *italic*, **bold**
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_\{[^}]+\})/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const t = m[0];
    if (t.startsWith('_{')) out.push(new TextRun({ text: t.slice(2, -1), subScript: true, font: FONT, ...base }));
    else if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: FONT, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}
const P = (text, opts = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: opts.noIndent ? 0 : 202 },
    spacing: { after: 0, line: 228, lineRule: LineRuleType.AUTO },
    children: runs(text, { size: 20 }),
    ...opts.p
  });
const H1 = (text) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80 },
    keepNext: true,
    children: [new TextRun({ text, font: FONT, size: 20, smallCaps: true })]
  });
const H2 = (text) =>
  new Paragraph({
    spacing: { before: 80, after: 40 },
    keepNext: true,
    children: [new TextRun({ text, font: FONT, size: 20, italics: true })]
  });
const bullet = (label, text) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 202, hanging: 202 },
    spacing: { after: 0, line: 228 },
    children: [new TextRun({ text: label + ' ', font: FONT, size: 20 }), ...runs(text, { size: 20 })]
  });
const eq = (text, num) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [...runs(text, { size: 20, italics: false }), new TextRun({ text: `\t(${num})`, font: FONT, size: 20 })],
    tabStops: [{ type: 'right', position: 4990 }]
  });

// ---------- figures ----------
function img(file, widthPx) {
  const buf = fs.readFileSync(FIG + file);
  // PNG size from header
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return new ImageRun({ type: 'png', data: buf, transformation: { width: widthPx, height: Math.round((widthPx * h) / w) } });
}
const figure = (file, widthPx, caption) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, keepNext: true, children: [img(file, widthPx)] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: runs(caption, { size: 16 })
  })
];

// ---------- tables ----------
const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
function table(caption, headers, rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (t, i, head, last) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 20, bottom: 20, left: 50, right: 50 },
      verticalAlign: VerticalAlign.CENTER,
      shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDED' } : undefined,
      borders: { top: thin, bottom: thin, left: thin, right: thin },
      children: [
        new Paragraph({
          alignment: i === 0 && !opts.centerFirst ? AlignmentType.LEFT : AlignmentType.CENTER,
          spacing: { after: 0 },
          keepNext: !last,
          keepLines: true,
          children: runs(t, { size: opts.size || 15, bold: head })
        })
      ]
    });
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 20 },
      keepNext: true,
      children: [new TextRun({ text: caption[0], font: FONT, size: 16, smallCaps: true })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      keepNext: true,
      children: [new TextRun({ text: caption[1], font: FONT, size: 16, smallCaps: true })]
    }),
    new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: widths,
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, true, false)) }),
        ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, ri === rows.length - 1)) }))
      ]
    }),
    new Paragraph({ spacing: { after: 80 }, children: [] })
  ];
}

// ---------- sections ----------
const twoCol = (children) => ({
  properties: {
    type: SectionType.CONTINUOUS,
    page: { size: PAGE, margin: MARGIN },
    column: { count: 2, space: COLGAP, equalWidth: true }
  },
  children
});
const oneCol = (children) => ({
  properties: { type: SectionType.CONTINUOUS, page: { size: PAGE, margin: MARGIN }, column: { count: 1 } },
  children
});

const content = require('./content.js')({ P, H1, H2, bullet, eq, figure, table, runs, TextRun, Paragraph, AlignmentType, FONT, Table, TableRow, TableCell, WidthType });

// ---------- title block ----------
const author = (name, lines) =>
  new TableCell({
    width: { size: 2570, type: WidthType.DXA },
    borders: { top: none, bottom: none, left: none, right: none },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: name, font: FONT, size: 22 })] }),
      ...lines.map(
        (l, i) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [new TextRun({ text: l, font: FONT, size: 18, italics: i < 2 })]
          })
      )
    ]
  });
const affil = ['Department of Information Technology', 'KPR Institute of Engineering and Technology', 'Coimbatore, India'];
const title = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'MedLedger AI: Patient-Controlled Health Records with Encrypted Storage, an Ethereum-Anchored Record History and Privacy-Preserving AI Analysis', font: FONT, size: 44 })]
  }),
  new Table({
    width: { size: 10280, type: WidthType.DXA },
    columnWidths: [2570, 2570, 2570, 2570],
    alignment: AlignmentType.CENTER,
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          author('Pankaj Baduwal', [...affil, '23IT040@kpriet.ac.in']),
          author('Yamraj Chaudhary', [...affil, '23IT069@kpriet.ac.in']),
          author('Vikasini S', [...affil, '23IT064@kpriet.ac.in']),
          author('Dr. M. Ashok Kumar', ['Associate Professor, Department of Information Technology', 'KPR Institute of Engineering and Technology', 'Coimbatore, India'])
        ]
      })
    ]
  }),
  new Paragraph({ spacing: { after: 240 }, children: [] })
];

const doc = new Document({
  creator: 'MedLedger AI team',
  title: 'MedLedger AI',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [
    { properties: { page: { size: PAGE, margin: MARGIN }, column: { count: 1 } }, children: title },
    ...content.sections(twoCol, oneCol)
  ]
});
Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync('/tmp/claude-0/paper/MedLedger_AI_Conference_Paper.docx', b);
  console.log('written');
});
