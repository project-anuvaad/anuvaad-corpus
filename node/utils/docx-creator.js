const docx = require("docx");
var fs = require('fs');
var LOG = require('../logger/logger').logger
var UUIDV4 = require('uuid/v4')

const NER_FIRST_PAGE_IDENTIFIERS = {
    'REPORTABLE_TYPE': { align: 'CENTER', position: 4500, is_new_line: true, font_size: 19, is_bold: true, font: 'Times' },
    'JURISDICTION': { align: 'CENTER', position: 4500, is_new_line: true, font_size: 18, font: 'Times' },
    'FORUM_NAME': { align: 'CENTER', position: 4500, is_new_line: true, font_size: 19, is_bold: true, font: 'Times' },
    'FIRST_PARTY': { align: 'LEFT', position: 500, font_size: 12, font: 'Times' },
    'FIRST_PARTY_TYPE': { align: 'RIGHT', is_new_line: true, position: docx.TabStopPosition.MAX, font_size: 12, font: 'Times' },
    'SECOND_PARTY': { align: 'LEFT', position: 500, font_size: 12, font: 'Times' },
    'SECOND_PARTY_TYPE': { align: 'RIGHT', is_new_line: true, position: docx.TabStopPosition.MAX, font_size: 12, font: 'Times' },
    'WITH_HEADER': { align: 'CENTER', position: 4500, is_new_line: true, font_size: 17, font: 'Times' },
    'CASE_IDENTIFIER': { align: 'CENTER', position: 4500, is_new_line: true, font_size: 17, font: 'Times' },
    'SLP': { align: 'CENTER', position: 4500, is_new_line: true, font_size: 17, font: 'Times' },
    'JUDGMENT_ORDER_HEADER': { align: 'CENTER', position: 4500, is_new_line: true, font_size: 19, is_bold: true, font: 'Times' },
    'JUDGE_NAME': { align: 'LEFT', position: 0, is_new_line: true, font_size: 19, is_bold: true, font: 'Times', underline: true },
}

const NER_LAST_PAGE_IDENTIFIERS = {
    'JUDGMENT_JUDGE_SIGNATURE': { align: 'RIGHT', is_new_line: true, position: docx.TabStopPosition.MAX, font_size: 17, font: 'Times' },
    'JUDGE_NAME': { align: 'RIGHT', is_new_line: true, position: docx.TabStopPosition.MAX, font_size: 17, font: 'Times' },
    'JUDGMENT_LOCATION': { align: 'LEFT', is_new_line: true, position: 500, font_size: 17, font: 'Times' },
    'JUDGMENT_DATE': { align: 'LEFT', is_new_line: true, position: 500, font_size: 17, font: 'Times' },
}

const HEADER_STYLE = {
    id: 'header',
    name: 'header',
    paragraph: {
        // indent: {
        //     left: d.x * 4
        // },
        spacing: {
            before: 340,
            after: 820,
        },
    }
}

const DEFAULT_STYLE = {
    id: 'DEFAULT',
    name: 'DEFAULT',
    paragraph: {
        spacing: {
            before: 200,
            after: 520,
        },
    }
}

var ner_run_arr = []
var tab_stops = []


function constructRunForNers(n, identifier_tag, children) {
    let tab_run = new docx.TextRun({
        text: '\t',
    })
    let ner_run = new docx.TextRun({
        text: n.tagged_value + ' ',
        size: identifier_tag.font_size * 2,
        font: identifier_tag.font,
        bold: identifier_tag.is_bold ? true : null,
        underline: identifier_tag.underline ? true : null
    })
    tab_stops.push({
        type: docx.TabStopType[identifier_tag.align],
        position: identifier_tag.position,
    })
    ner_run_arr.push(tab_run)
    ner_run_arr.push(ner_run)
    if (identifier_tag.is_new_line) {
        let text_run =
            new docx.Paragraph({
                style: 'DEFAULT',
                children: ner_run_arr,
                tabStops: tab_stops,
            })
        children.push(text_run)
        if (n.annotation_tag === 'FIRST_PARTY_TYPE') {
            let text_run = new docx.Paragraph({
                style: 'VERSUS',
                children: [new docx.TextRun({
                    text: 'Versus',
                    size: identifier_tag.font_size * 2,
                    font: identifier_tag.font,
                    bold: identifier_tag.is_bold ? true : null,
                })],
            })
            children.push(text_run)
        }
        ner_run_arr = []
        tab_stops = []
    }
    return children
}



exports.covertJsonToDoc = function (data, ner_data, nginx_path, header_text, footer_text, cb) {
    let styles = []
    let children = []
    let last_page_runs = []
    let footnote_count = 1
    let FOOTNOTE_RUN_ARRAY = []
    let JUDGMENT_ORDER_HEADER_PAGE_NO = -1
    let JUDGE_NAME_PAGE_NO = -1
    let JUDGMENT_ORDER_HEADER = ''
    let JUDGE_NAME = ''
    let JUDGMENT_ORDER_HEADER_FOUND = false
    let LAST_PAGE_NER_BEGINNING = ''
    let LAST_PAGE_NER_BEGINNING_FOUND = false
    let previous_footnote = ''

    styles.push(DEFAULT_STYLE)
    styles.push(HEADER_STYLE)
    ner_data.map((ner, index) => {
        if ((JUDGMENT_ORDER_HEADER.length == 0 && JUDGMENT_ORDER_HEADER_PAGE_NO >= index) || (JUDGE_NAME.length == 0)) {
            ner_run_arr = []
            tab_stops = []
            ner.map((n) => {
                if (Object.keys(NER_FIRST_PAGE_IDENTIFIERS).indexOf(n.annotation_tag) >= 0) {
                    let identifier_tag = NER_FIRST_PAGE_IDENTIFIERS[n.annotation_tag]
                    children = constructRunForNers(n, identifier_tag, children)
                }
                if (n.annotation_tag === 'JUDGMENT_ORDER_HEADER') {
                    JUDGMENT_ORDER_HEADER_PAGE_NO = index + 1
                    JUDGMENT_ORDER_HEADER = n.tagged_value
                }
                else if (n.annotation_tag === 'JUDGE_NAME' && JUDGMENT_ORDER_HEADER_PAGE_NO >= 0) {
                    JUDGE_NAME_PAGE_NO = index + 1
                    JUDGE_NAME = n.tagged_value
                }
            })
        }
        else {
            return
        }
    })
    let last_page_ner = ner_data[ner_data.length - 1]
    last_page_ner.map((n) => {
        if (Object.keys(NER_LAST_PAGE_IDENTIFIERS).indexOf(n.annotation_tag) >= 0) {
            if (LAST_PAGE_NER_BEGINNING.length == 0) {
                LAST_PAGE_NER_BEGINNING = n.tagged_value
            }
            if (n.annotation_tag == 'JUDGMENT_DATE') {
                let ner_obj = { annotation_tag: 'JUDGMENT_LOCATION', tagged_value: 'New Delhi' }
                let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[ner_obj.annotation_tag]
                last_page_runs = constructRunForNers(ner_obj, identifier_tag, last_page_runs)
            }
            let identifier_tag = NER_LAST_PAGE_IDENTIFIERS[n.annotation_tag]
            last_page_runs = constructRunForNers(n, identifier_tag, last_page_runs)
        }
    })
    data.map((d, index) => {
        let remaining_text = ''
        //For handling last page related ner
        if (d.page_no >= ner_data.length && !LAST_PAGE_NER_BEGINNING_FOUND) {
            if (d.text.indexOf(LAST_PAGE_NER_BEGINNING) >= 0) {
                LAST_PAGE_NER_BEGINNING_FOUND = true
                return
            }
        }
        if (LAST_PAGE_NER_BEGINNING_FOUND) {
            return true
        }

        //For handling first page related ner
        if (((JUDGE_NAME_PAGE_NO >= 0 && d.page_no <= JUDGE_NAME_PAGE_NO) || (JUDGE_NAME_PAGE_NO === -1 && d.page_no <= JUDGMENT_ORDER_HEADER_PAGE_NO)) && !JUDGMENT_ORDER_HEADER_FOUND) {
            if (JUDGE_NAME.length > 0 && d.text.indexOf(JUDGE_NAME) >= 0) {
                remaining_text = d.text.replace(JUDGE_NAME, '')
                JUDGMENT_ORDER_HEADER_FOUND = true
            }
            else if (JUDGE_NAME.length == 0 && d.text.indexOf(JUDGMENT_ORDER_HEADER) >= 0) {
                remaining_text = d.text.replace(JUDGMENT_ORDER_HEADER, '')
                JUDGMENT_ORDER_HEADER_FOUND = true
            }
            if (remaining_text.trim().length < 1)
                return
        }
        let style = {
            id: index,
            name: index,
            paragraph: {
                // indent: {
                //     left: d.x * 4
                // },
                spacing: {
                    before: 540,
                    after: 520,
                },
            }
        }
        if (!d.is_footer) {
            let text_arr = []
            let text = new docx.TextRun({
                text: remaining_text.trim().length > 0 ? remaining_text : d.text,
                size: d.class_style['font-size'].split('px')[0] * 2,
                font: d.class_style['font-family'],
                bold: d.is_bold ? true : null,
                underline: d.underline ? {} : null
            })
            remaining_text = ''
            text_arr.push(text)
            if (d.sup_array && d.sup_array.length > 0) {
                d.sup_array.map((sup, index) => {
                    if (parseInt(sup) <= footnote_count) {
                        let sup_number = parseInt(sup)
                        let sup_run = new docx.TextRun({
                            text: sup,
                            children: [new docx.FootnoteReferenceRun(sup_number)],
                            superScript: true,
                            size: d.class_style['font-size'].split('px')[0] * 2,
                            font: d.class_style['font-family'],
                        })
                        text_arr.push(sup_run)
                        if (index !== d.sup_array.length - 1) {
                            let sup_run = new docx.TextRun({
                                text: ',',
                                superScript: true,
                                size: d.class_style['font-size'].split('px')[0] * 2,
                                font: d.class_style['font-family'],
                            })
                            text_arr.push(sup_run)
                        }
                        footnote_count++
                    }
                })
            }
            let text_run = new docx.Paragraph({
                style: index,
                children: text_arr
            })
            children.push(text_run)
        } else {
            if (parseInt(d.text.split(" ")[0]) !== FOOTNOTE_RUN_ARRAY.length + 1) {
                previous_footnote = previous_footnote + ' ' + d.text
                FOOTNOTE_RUN_ARRAY[FOOTNOTE_RUN_ARRAY.length - 1] = new docx.Paragraph(previous_footnote)
            } else {
                let words_array = d.text.split(' ')
                let footer_text = words_array.slice(1, words_array.length).join(' ')
                FOOTNOTE_RUN_ARRAY.push(new docx.Paragraph(footer_text))
                previous_footnote = footer_text
            }

        }
        styles.push(style)
        styles.push({
            id: 'VERSUS',
            name: 'VERSUS',
            paragraph: {
                indent: {
                    left: 4200
                },
                spacing: {
                    before: 240,
                    after: 320,
                },
            }
        })
    })
    children = children.concat(last_page_runs)
    // Create document
    const doc = new docx.Document({
        styles: {
            paragraphStyles: styles
        },
        footnotes: FOOTNOTE_RUN_ARRAY
    });
    doc.addSection({
        headers: {
            default: new docx.Header({
                children: [
                    new docx.Paragraph({
                        style: 'header',
                        alignment: docx.AlignmentType.RIGHT,
                        children: [
                            new docx.TextRun({
                                children: ["Page Number ", docx.PageNumber.CURRENT],
                            }),
                            new docx.TextRun({
                                children: [" of ", docx.PageNumber.TOTAL_PAGES],
                            }),
                        ],
                    }),
                    new docx.Paragraph({
                        style: 'header',
                        alignment: docx.AlignmentType.LEFT,
                        children: [
                            new docx.TextRun({
                                text: header_text
                            }),
                        ],
                    }),
                ],
            }),
        },
        footers: {
            default: new docx.Footer({
                children: [
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: footer_text,
                                size: 20,
                                color: '000000',
                                underline: true,
                                font: 'Times'
                            })]
                    })],
            }),
        },
        children: children,
    });

    // Used to export the file into a .docx file
    docx.Packer.toBuffer(doc).then((buffer) => {
        let file_name = UUIDV4() + (new Date().getMilliseconds()) + ".docx"
        fs.writeFileSync(nginx_path + file_name, buffer);
        cb(null, file_name)
    }).catch(e => {
        LOG.error(e)
        cb(e, null)
    });
}