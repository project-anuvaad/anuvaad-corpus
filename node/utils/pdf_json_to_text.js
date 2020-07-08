const htmlToJson = require('html-to-json')
const fs = require('fs');
var LOG = require('../logger/logger').logger
const sentence_ends_regex = /(([\"|”|,|a-zA-Z\u0900-\u097F|0-9|.]{2,}[.|?|।|!|\"|”|:|;]|([:][ ][-]))$)/g;
const abbrivations2 = [' no.', ' mr.', ' ft.', ' kg.', ' dr.', ' ms.', ' st.', ' pp.', ' co.', ' rs.', ' sh.', ' vs.', ' ex.']
const abbrivations3 = [' pvt.', ' nos.', ' smt.', ' sec.', ' spl.', ' kgs.', ' ltd.', ' pty.', ' vol.', ' pty.', ' m/s.', ' mrs.', ' i.e.', ' etc.', ' (ex.', ' o.s.', ' anr.', ' ors.']
const abbrivations4 = [' assn.']
const abbrivations6 = [' w.e.f.']
const sentence_ends = ['.', '"', '?', '!', '”', '।']
const PAGE_BREAK_IDENTIFIER = '__LINE_BREAK__'
const DIGITAL_SIGN_IDENTIFIER = '__DIGITAL_SIGN__'




function checkForTable(text_node, image_data) {
    let table_check_obj = { is_table: false, class_identifier: null }
    if (image_data.tables && Array.isArray(image_data.tables)) {
        image_data.tables.map((table) => {
            if (parseInt(text_node.y) >= table.y && parseInt(text_node.y) <= table.y + table.h) {
                table.rect.map((rect) => {
                    if ((parseInt(text_node.y) >= table.y + rect.y || table.y + rect.y - parseInt(text_node.y) < 4) && parseInt(text_node.y) <= table.y + rect.y + rect.h - 3 && parseInt(text_node.x) >= table.x + rect.x && parseInt(text_node.x) <= table.x + rect.x + rect.w) {
                        table_check_obj = { is_table: true, class_identifier: table.x + '_' + table.y + '_' + rect.x + '_' + rect.y, row: rect.index[0], column: rect.index[1], parent_table: table }
                    }
                })
            }
        })
    }
    return table_check_obj
}

exports.mergeParagraphJsonNodes = function (items, cb) {
    let output = []
    items.map((obj, pageindex) => {
        obj.map((it, index) => {
            if (output.length == 0) {
                output.push(it)
            } else {
                if (output[output.length - 1].page_no_end !== it.page_no_end) {
                    if ((!(it.text.search(sentence_ends_regex) >= 0) || abbrivations2.indexOf(it.text.substring(it.text.length - 4, it.text.length).toLowerCase()) >= 0 || abbrivations3.indexOf(it.text.substring(it.text.length - 5, it.text.length).toLowerCase()) >= 0 || abbrivations4.indexOf(it.text.substring(it.text.length - 6, it.text.length).toLowerCase()) >= 0 || abbrivations6.indexOf(it.text.substring(it.text.length - 8, it.text.length).toLowerCase()) >= 0)) {
                        output[output.length - 1].text += ' '+it.text
                        output[output.length - 1].page_no_end = it.page_no_end
                    }else{
                        output.push(it)
                    }
                } else {
                    if (output[output.length - 1].block_num == it.block_num) {
                        output[output.length - 1].text += ' ' + it.text
                        output[output.length - 1].page_no_end = it.page_no_end
                    } else {
                        output.push(it)
                    }
                }
            }
        })
    })
    cb(null, output)
}

exports.mergeParagraphJsonNodesV2 = function (items, cb) {
    let output = []
    let previous = {}
    items.map((obj, pageindex) => {
        obj.line_data.map((it, index) => {
            if (output.length == 0) {
                output.push(it)
            } else {
                if (output[output.length - 1].page_no_end !== it.page_no_end) {
                    if(previous.visual_break == 1){
                        output.push(it)
                    }
                    else if ((!(it.text.search(sentence_ends_regex) >= 0) || abbrivations2.indexOf(it.text.substring(it.text.length - 4, it.text.length).toLowerCase()) >= 0 || abbrivations3.indexOf(it.text.substring(it.text.length - 5, it.text.length).toLowerCase()) >= 0 || abbrivations4.indexOf(it.text.substring(it.text.length - 6, it.text.length).toLowerCase()) >= 0 || abbrivations6.indexOf(it.text.substring(it.text.length - 8, it.text.length).toLowerCase()) >= 0)) {
                        output[output.length - 1].text += ' '+it.text
                        output[output.length - 1].page_no_end = it.page_no_end
                    }else{
                        output.push(it)
                    }
                } else {
                    if (output[output.length - 1].blob_id == it.blob_id && previous.visual_break == 0) {
                        output[output.length - 1].text += ' ' + it.text
                        output[output.length - 1].page_no_end = it.page_no_end
                    } else {
                        output.push(it)
                    }
                }
            }
            previous = it
        })
    })
    cb(null, output)
}



exports.mergeJsonNodes = function (items, image_data, cb) {
    let output = []
    let style_map = {}
    //Find header or footer
    let header_end_index = -1
    let footer_start_index = -1
    let page_no_start_index = -1
    let page_no_end_index = -1
    let page_no_text = ''
    let footer_text = ''
    let header_text = ''
    let previous_node = null
    let previous_footer_node = null
    let variable_header = false
    let footer_available = false
    let change_style_map = false
    let is_super = false
    let is_sub = false
    let same_line = false
    let need_to_add_in_array = true
    let bottom_px = -1
    let footer_coordinate = -1
    LOG.info(items)
    items.map((obj, key) => {
        obj.map((it, index) => {
            change_style_map = false
            is_sub = false
            is_super = false
            same_line = false
            need_to_add_in_array = true
            if (it.text.indexOf(DIGITAL_SIGN_IDENTIFIER) >= 0) {
                return
            }
            else if (it.text.trim().length == 0) {
                return
            }
            else if (parseInt(it.text.trim()) == parseInt(it.page_no) && (index > obj.length - 4 || index < 5)) {
                return
            }
            else if ((page_no_start_index !== -1 && index === page_no_start_index) || (page_no_end_index !== -1 && index === obj.length - page_no_end_index - 1) || (key == 1 && page_no_text.trim().length > 0 && sentence_ends.indexOf(page_no_text) < 0 && it.text.replace(/\d+/g, '').replace(/\s+/g, '') === page_no_text)) {
                return
            }
            else if (header_end_index !== -1 && index <= header_end_index) {
                return
            }
            else if ((footer_start_index !== -1 && index >= obj.length - footer_start_index - 1) || key == 1 && it.text === footer_text) {
                return
            }

            let font_size = it.class_style['font-size'].split('px')[0]

            if (image_data && image_data.lines && image_data.lines.length > 0) {
                image_data.lines.map((line) => {
                    if (line.y !== footer_coordinate) {
                        let y_margin = (parseInt(line.y) - (parseInt(it.y) + parseInt(font_size))) / bottom_px
                        let x_margin = (parseInt(line.x) - parseInt(it.x)) / parseInt(line.x)
                        if (((y_margin >= 0 && y_margin * 100 < 4) || (parseInt(line.y) >= parseInt(it.y) && parseInt(line.y) <= (parseInt(it.y) + parseInt(font_size)))) && Math.abs(x_margin) * 100 < 3) {
                            it.underline = true
                        }
                    }
                })
            }

            let table_check = checkForTable(it, image_data)


            //Make the class identifier to search in map for previously used node
            let class_identifier = it.class_style['font-size'] + it.class_style['font-family'] + it.is_bold
            if (table_check.is_table) {
                class_identifier = table_check.class_identifier
                it.is_table = true
                it.parent_table = table_check.parent_table
                it.table_row = table_check.row
                it.table_column = table_check.column
            }
            if (output && output.length > 0) {

                //Check for sub and super script
                if (!it.is_table && !style_map[class_identifier] && previous_node && previous_node.page_no === it.page_no && ((parseInt(previous_node.y_end) >= parseInt(it.y_end) && parseInt(it.y_end) + parseInt(it.class_style['font-size'].split('px')[0]) >= parseInt(previous_node.y_end)) || (parseInt(previous_node.y_end) <= parseInt(it.y_end) && parseInt(it.y_end) <= parseInt(previous_node.y_end) + parseInt(previous_node.class_style['font-size'].split('px')[0]))) && it.text.trim().length > 0) {
                    class_identifier = previous_node.class_style['font-size'] + previous_node.class_style['font-family'] + previous_node.is_bold
                    if (isNaN(it.text.trim()) || (previous_node.y_end == it.y_end && parseInt(it.y_end) + parseInt(it.class_style['font-size'].split('px')[0]) >= parseInt(previous_node.y_end) + parseInt(previous_node.class_style['font-size'].split('px')[0]))) {
                        same_line = true
                    }
                    else if ((parseInt(previous_node.y_end) >= parseInt(it.y_end) && parseInt(it.y_end) + parseInt(it.class_style['font-size'].split('px')[0]) >= parseInt(previous_node.y_end))) {
                        is_super = true
                    } else {
                        is_sub = true
                    }
                }

                //Check with previous node class identifier so end the previous node and not merge other nodes in that node
                if (!it.is_table && !same_line && previous_node && (class_identifier !== previous_node.class_style['font-size'] + previous_node.class_style['font-family'] + previous_node.is_bold || it.underline)) {
                    if (!previous_node.is_bold && it.is_bold && it.node_index - previous_node.node_index == 1 && (previous_node.class_style['font-size'] + previous_node.class_style['font-family'] == it.class_style['font-size'] + it.class_style['font-family'])) {
                        class_identifier = previous_node.class_style['font-size'] + previous_node.class_style['font-family'] + previous_node.is_bold
                        it.is_bold = false
                    } else if (!is_sub && !is_super) {
                        style_map[previous_node.class_style['font-size'] + previous_node.class_style['font-family'] + previous_node.is_bold] = null
                        change_style_map = true
                    }
                }
                if (style_map[class_identifier] && it.page_no_end - style_map[class_identifier].data.page_no_end <= 1 && !it.underline) {
                    let old_data = style_map[class_identifier]
                    let data = old_data.data
                    //If previous node class identifier is different than the current node then current node is a new sentence
                    if (change_style_map) {

                        style_map[class_identifier] = null
                        class_identifier = it.class_style['font-size'] + it.class_style['font-family'] + it.is_bold
                    }
                    data.text = data.text.trim()

                    if (same_line || is_super || is_sub || (!(data.text.search(sentence_ends_regex) >= 0) || abbrivations2.indexOf(data.text.substring(data.text.length - 4, data.text.length).toLowerCase()) >= 0 || abbrivations3.indexOf(data.text.substring(data.text.length - 5, data.text.length).toLowerCase()) >= 0 || abbrivations4.indexOf(data.text.substring(data.text.length - 6, data.text.length).toLowerCase()) >= 0 || abbrivations6.indexOf(data.text.substring(data.text.length - 8, data.text.length).toLowerCase()) >= 0)) {
                        if (it.is_table || !((it.node_index - data.node_index > 2) && it.page_no_end - old_data.data.page_no_end == 0) || (it.page_no_end - old_data.data.page_no_end == 1)) {

                            if (is_sub || is_super) {
                                if (it.text.trim().length > 1 && isNaN(it.text)) {
                                    old_data.data.text += " " + it.text.replace(/\s+/g, " ").trim()
                                } else {
                                    if (is_sub) {
                                        let sub_array = old_data.data.sub_array ? old_data.data.sub_array : []
                                        sub_array.push(it.text.replace(/\s+/g, " "))
                                        old_data.data.sub_array = sub_array
                                    } else {
                                        let sup_array = old_data.data.sup_array ? old_data.data.sup_array : []
                                        sup_array.push(it.text.replace(/\s+/g, " "))
                                        old_data.data.sup_array = sup_array
                                    }
                                }
                            } else {
                                old_data.data.text += " " + it.text.replace(/\s+/g, " ").trim()
                            }
                            old_data.data.y_end = it.y_end
                            old_data.data.node_index = it.node_index
                            old_data.data.page_no_end = it.page_no_end
                            output[old_data.index] = old_data.data
                            style_map[class_identifier] = old_data
                            need_to_add_in_array = false
                        }
                    }
                }
            }
            if (need_to_add_in_array) {
                output.push(it)
                if (!it.underline)
                    style_map[class_identifier] = { index: output.length - 1, data: it }
            }
            if (!same_line && !is_sub && !is_super && !it.underline && it.text.trim().length > 0) {
                previous_node = it
            }

        })
    })
    var out = output.filter((o, index) => {
        o.text = o.text.replace(/\s+/g, " ")
        // o.text = o.text.replace(/Digitally signed by.{1,}Reason:/gm, '')
        // o.text = o.text.replace(/Signature Not Verified/gm, '')
        // o.text = o.text.replace(DIGITAL_SIGN_IDENTIFIER, '')
        o.text = o.text.trim()
        if (o.text.length > 0) {
            return true
        }
        return false
    })
    cb(null, out, header_text, footer_text)
}