const docx = require("docx");
var fs = require('fs');

const NER_IDENTIFIERS_ARR = ['REPORTABLE_TYPE','FORUM_NAME','FIRST_PARTY', 'FIRST_PARTY_TYPE', 'SECOND_PARTY', 'SECOND_PARTY_TYPE','JUDGMENT_ORDER_HEADER']
const NER_IDENTIFIERS = {
    'REPORTABLE_TYPE': { align: 'CENTER', position: 4500,is_new_line: true },
    'FORUM_NAME': { align: 'CENTER', position: 4500,is_new_line: true },
    'FIRST_PARTY': { align: 'LEFT', position: 500 },
    'FIRST_PARTY_TYPE': { align: 'RIGHT', is_new_line: true, position: docx.TabStopPosition.MAX },
    'SECOND_PARTY': { align: 'LEFT', position: 500 },
    'SECOND_PARTY_TYPE': { align: 'RIGHT', is_new_line: true, position: docx.TabStopPosition.MAX },
    'JUDGMENT_ORDER_HEADER': { align: 'CENTER', position: 4500,is_new_line: true },
    'DEFAULT': { align: 'LEFT', position: 0 }
}



exports.covertJsonToDoc = function (data, cb) {
    let styles = []
    let children = []
    data.map((d, index) => {
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
        if (d.ner && d.ner.length > 0) {
            let remaining_text = d.text
            let ner_run_arr = []
            let tab_stops = []
            d.ner.map((ner_data, index) => {
                remaining_text = remaining_text.replace(ner_data.tagged_value, '')
                if (NER_IDENTIFIERS_ARR.indexOf(ner_data.annotation_tag) >= 0) {
                    let tab_run = new docx.TextRun({
                        text: '\t',
                        size: d.class_style['font-size'].split('px')[0] * 2,
                    })
                    let ner_run = new docx.TextRun({
                        text: ner_data.tagged_value + ' ',
                        size: d.class_style['font-size'].split('px')[0] * 2,
                        font: d.class_style['font-family'],
                        bold: d.is_bold ? true : null,
                        underline: d.underline ? {} : null
                    })
                    tab_stops.push({
                        type: docx.TabStopType[NER_IDENTIFIERS[ner_data.annotation_tag].align],
                        position: NER_IDENTIFIERS[ner_data.annotation_tag].position,
                    })
                    ner_run_arr.push(tab_run)
                    ner_run_arr.push(ner_run)
                    if (NER_IDENTIFIERS[ner_data.annotation_tag].is_new_line) {
                        let text_run =
                            new docx.Paragraph({
                                style: index,
                                children: ner_run_arr,
                                tabStops: tab_stops,
                            })
                        children.push(text_run)
                        if (ner_data.annotation_tag === 'FIRST_PARTY_TYPE') {
                            let text_run = new docx.Paragraph({
                                style: 'VERSUS',
                                children: [new docx.TextRun({
                                    text: 'Versus',
                                    size: d.class_style['font-size'].split('px')[0] * 2,
                                    font: d.class_style['font-family'],
                                    bold: d.is_bold ? true : null,
                                    underline: d.underline ? {} : null
                                })],
                            })
                            children.push(text_run)
                        }
                        ner_run_arr = []
                        tab_stops = []
                    }
                } else {
                    let identifier_tag = NER_IDENTIFIERS[ner_data.annotation_tag] ? NER_IDENTIFIERS[ner_data.annotation_tag] : NER_IDENTIFIERS['DEFAULT']
                    let text_run =
                        new docx.Paragraph({
                            style: index,
                            children: [
                                new docx.TextRun({
                                    text: ner_data.tagged_value + ' ',
                                    size: d.class_style['font-size'].split('px')[0] * 2,
                                    font: d.class_style['font-family'],
                                    bold: d.is_bold ? true : null,
                                    underline: d.underline ? {} : null
                                })
                            ],
                        })
                    children.push(text_run)
                }
            })
            if (remaining_text.trim().length > 0) {
                let text_run =
                    new docx.Paragraph({
                        style: index,
                        children: [new docx.TextRun({
                            text: remaining_text,
                            size: d.class_style['font-size'].split('px')[0] * 2,
                            font: d.class_style['font-family'],
                            bold: d.is_bold ? true : null,
                            underline: d.underline ? {} : null
                        })
                        ]
                    })
                children.push(text_run)
            }
        } else {
            let text_run =
                new docx.Paragraph({
                    style: index,
                    children: [new docx.TextRun({
                        text: d.text,
                        size: d.class_style['font-size'].split('px')[0] * 2,
                        font: d.class_style['font-family'],
                        bold: d.is_bold ? true : null,
                        underline: d.underline ? {} : null
                    })
                    ]
                })
            children.push(text_run)
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

    // Documents contain sections, you can have multiple sections per document, go here to learn more about sections
    // This simple example will only contain one section
    // doc.addSection({
    //     properties: {},
    //     children: [
    //         new docx.Paragraph({
    //             children: [
    //                 new docx.TextRun("Hello World"),
    //                 new docx.TextRun({
    //                     text: "Foo Bar",
    //                     bold: true,
    //                 }),
    //                 new docx.TextRun({
    //                     text: "\tGithub is the best",
    //                     bold: true,
    //                 }),
    //             ],
    //         }),
    //     ],
    // });
    // Create document
    const doc = new docx.Document({
        styles: {
            paragraphStyles: styles
        }
    });
    doc.addSection({
        children: children,
    });

    // Used to export the file into a .docx file
    docx.Packer.toBuffer(doc).then((buffer) => {
        fs.writeFileSync("test.docx", buffer);
        cb()
    }).catch(e => {
        console.log(e)
        cb()
    });
}