const htmlToJson = require('html-to-json')
const fs = require('fs');
var LOG = require('../logger/logger').logger
const sentence_ends_regex = /(([\"|”|,|a-zA-Z\u0900-\u097F|0-9|.]{3,}[।|.|?|!|\"|”|:|;]|([:][ ][-]))$)/g;
const abbrivations2 = [' no.', ' mr.', ' ft.', ' kg.', ' dr.', ' ms.', ' st.', ' pp.', ' co.', ' rs.', ' sh.', ' vs.', ' ex.']
const abbrivations3 = [' pvt.', ' nos.', ' smt.', ' sec.', ' spl.', ' kgs.', ' ltd.', ' pty.', ' vol.', ' pty.', ' m/s.', ' mrs.', ' i.e.', ' etc.', ' (ex.', ' o.s.', ' anr.', ' ors.', ' c.a.']
const abbrivations4 = [' assn.']
const abbrivations6 = [' w.e.f.']
const sentence_ends = ['.', '"', '?', '!', '”', "।"]
const PAGE_BREAK_IDENTIFIER = '__LINE_BREAK__'
const DIGITAL_SIGN_IDENTIFIER = '__DIGITAL_SIGN__'



exports.convertHtmlTextToJson = function (text, cb) {
    htmlToJson.parse(text, function () {
        return this.map('p', function ($item) {
            let obj = {}
            var is_bold = false
            var underline = false
            if ($item['0'].children) {
                $item['0'].children.map((child) => {
                    if ((child.name === 'b' || child.name === 'strong')) {
                        is_bold = true
                    }
                    if (child.name === 'u') {
                        underline = true
                    }
                    if (child.children) {
                        child.children.map((c) => {
                            if ((c.name === 'b' || c.name === 'strong')) {
                                is_bold = true
                            }
                            if (c.name === 'u') {
                                underline = true
                            }
                        })
                    }
                })
            }
            obj.is_bold = is_bold
            obj.underline = underline
            obj.text = $item.text()
            obj.text = obj.text.replace(/\n/g, '')
            obj.text = obj.text.trim()
            return obj
        })
    }).done(function (items) {
        let output = {}
        items.map((it, index) => {
            if (index == 0) {
                output = it
            }
            if (it.text.length > 0 && index != 0) {
                output.text += " " + it.text;
            }
        })
        cb(null, output)
    })
}

exports.convertHtmlToJsonPagewise = function (basefolder, inputfilename, session_id, merge, pageno, start_node_index, cb) {
    fs.readFile(basefolder + session_id + "/" + inputfilename, 'utf8', function (err, data) {
        let output = []
        data = data.replace(/<br\/>/g, PAGE_BREAK_IDENTIFIER)
        data = data.replace(/<i>/g, ' ')
        data = data.replace(/<i\/>/g, ' ')
        htmlToJson.parse(data, function () {
            var style_text = ''
            let page_height = 0
            let page_width = 0
            this.map('style', function ($item) {
                style_text += $item.toString()
            })
            this.map('img', function ($item) {
                page_height = $item['0']['attribs']['height']
                page_width = $item['0']['attribs']['width']
            })
            var node_index = start_node_index
            return this.map('p', function ($item) {
                var is_bold = false
                if ($item['0'].children) {
                    $item['0'].children.map((child) => {
                        if (child.name === 'b' && child.children && child.children.length > 0 && child.children[0].data == $item.text()) {
                            is_bold = true
                        }
                    })
                }
                let obj = {}
                let style = $item['0']['attribs']['style']
                let class_identifier = $item['0']['attribs']['class']
                let styles = style.split(';')
                styles.map((s) => {
                    let topLeft = s.split(':')
                    if (topLeft[0] == 'left') {
                        obj.x = topLeft[1].split('px')[0]
                    } else if (topLeft[0] == 'top') {
                        obj.y = topLeft[1].split('px')[0]
                    }
                })
                obj.y_end = obj.y
                obj.text = $item.text()
                obj.style = style
                obj['class'] = class_identifier
                obj['page_no'] = pageno
                obj['is_bold'] = is_bold
                obj['page_no_end'] = pageno
                obj['page_height'] = page_height
                obj['page_width'] = page_width
                let class_style_text = style_text.split(obj['class'])[1].split('}')[0].split('{')[1]
                let class_style_obj = {}
                class_style_text = class_style_text.split(';')
                class_style_text.map((c) => {
                    if (c.split(':')[0] == 'font-family') {
                        if (c.split(':')[1].indexOf('+') >= 0) {
                            class_style_obj[c.split(':')[0]] = c.split(':')[1].split('+')[1]
                        } else {
                            class_style_obj[c.split(':')[0]] = c.split(':')[1]
                        }

                    } else {
                        class_style_obj[c.split(':')[0]] = c.split(':')[1]
                    }

                })
                obj['class_style'] = class_style_obj
                obj.node_index = node_index
                node_index++
                return obj;
            });
        }).done(function (items) {
            if (merge) {
                items.map((it, index) => {
                    if (output && output.length > 0) {
                        let data = output[output.length - 1]
                        data.text += ' ' + it.text
                        data.text = data.text.replace(/\s+/g, " ")
                        data.text = data.text.replace(/__LINE_BREAK__/g, " ")
                        data.text = data.text.replace(/Digitally signed by.{1,}Signature Not Verified/gm, '')
                    } else {
                        output.push(it)
                    }
                })
                cb(null, output)
            } else {
                items.map((it) => {
                    if (it.text.indexOf(PAGE_BREAK_IDENTIFIER) >= 0) {
                        let text_array = it.text.split(PAGE_BREAK_IDENTIFIER)
                        if (it.class_style['line-height']) {
                            it.y_end = parseInt(it.y_end) + parseInt(it.class_style['line-height'].split('px')[0] * (text_array.length - 1))
                        } else {
                            it.y_end = parseInt(it.y_end) + parseInt(it.class_style['font-size'].split('px')[0] * (text_array.length - 1))
                        }
                        it.text = it.text.replace(/__LINE_BREAK__/g, " ")
                    }
                })
                // if (items.length > 0 && items[0].page_no == 1) {
                //     items.sort(function (a, b) {
                //         if (parseInt(a.y) == parseInt(b.y)) {
                //             return parseInt(a.x) - parseInt(b.x)
                //         } else {
                //             return parseInt(a.y) - parseInt(b.y)
                //         }
                //     });
                // }
                cb(null, items)
            }
        }, function (err) {
            cb(err, null)
        });
    })
}


function checkForTable(text_node, image_data) {
    let table_check_obj = { is_table: false, class_identifier: null }
    if (image_data && image_data.tables && Array.isArray(image_data.tables)) {
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


exports.mergeHtmlNodes = function (items, version, cb) {
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
    let change_style_map = false
    let is_super = false
    let is_sub = false
    let same_line = false
    let need_to_add_in_array = true
    let bottom_px = -1
    let footer_coordinate = -1
    Object.keys(items).forEach(function (key, index) {
        if (index != 0) {
            let obj = items[key].html_nodes
            let obj_prev = items[key - 1]
            let obj_next = items[key + 1]
            let obj_to_check = obj_next ? obj_next : obj_prev
            let current_header_end_index = -1
            let current_footer_start_index = -1
            let current_page_no_start_index = -1
            let current_page_no_end_index = -1
            if (obj_to_check) {
                obj_to_check = obj_to_check.html_nodes
                obj.map((it, index) => {
                    if (current_header_end_index == -1 || index - current_header_end_index == 1) {
                        if (obj_to_check[index] && obj_to_check[index].text === obj[index].text && obj[index].text.trim().length > 0) {
                            current_header_end_index = index
                            if (header_text.length == 0) {
                                header_text = obj[index].text
                            }

                        }
                    }
                    if (obj_to_check[index]) {
                        let current_text = it.text.replace(/\d+/g, '');
                        current_text = current_text.replace(/\s+/g, '')
                        if (current_text.length > 0) {
                            let next_text = obj_to_check[index].text.replace(/\d+/g, '');
                            next_text = next_text.replace(/\s+/g, '')
                            if (sentence_ends.indexOf(next_text) < 0 && next_text === current_text && current_text.trim().length > 0 && index !== current_header_end_index) {
                                current_page_no_start_index = index
                                page_no_text = next_text
                            }
                        }
                    }
                })
                obj.slice(0).reverse().map((it, index) => {
                    if (current_footer_start_index == -1 || index - current_footer_start_index == 1) {
                        if (obj_to_check[obj_to_check.length - index - 1] && obj_to_check[obj_to_check.length - index - 1].text === it.text && it.text.trim().length > 0) {
                            current_footer_start_index = index
                            footer_text = it.text
                        }
                    }
                    if (obj_to_check[obj_to_check.length - index - 1]) {
                        let current_text = it.text.replace(/\d+/g, '');
                        current_text = current_text.replace(/\s+/g, '')
                        if (current_text.length > 0) {
                            let next_text = obj_to_check[obj_to_check.length - index - 1].text.replace(/\d+/g, '');
                            next_text = next_text.replace(/\s+/g, '')
                            if (sentence_ends.indexOf(next_text) < 0 && next_text === current_text && index !== current_footer_start_index && current_text.trim().length > 0) {
                                current_page_no_end_index = index
                                page_no_text = next_text
                            }
                        }
                    }
                })
            }
            if (header_end_index !== -1 && header_end_index !== current_header_end_index) {
                variable_header = true
                header_end_index = -1
            } else {
                header_end_index = current_header_end_index
            }
            if (footer_start_index !== -1 && footer_start_index !== current_footer_start_index) {
                footer_start_index = -1
                footer_text = ''
            } else {
                footer_start_index = current_footer_start_index
            }
            if (page_no_start_index !== -1 && page_no_start_index !== current_page_no_start_index) {
                page_no_start_index = -1
            } else {
                if (!(index > 2 && page_no_start_index == -1)) {
                    page_no_start_index = current_page_no_start_index
                }
            }
            if (page_no_end_index !== -1 && page_no_end_index !== current_page_no_end_index) {
                page_no_end_index = -1
            } else {
                page_no_end_index = current_page_no_end_index
            }
        }
    })
    if (header_end_index == -1 || variable_header) {
        header_text = ''
    }
    if (page_no_end_index == -1 && page_no_start_index == -1) {
        page_no_text = ''
    }
    Object.keys(items).forEach(function (key, index) {
        footer_coordinate = -1
        bottom_px = -1
        previous_footer_node = null
        let footer_available = false
        let obj = items[key].html_nodes
        let image_data = items[key].image_data
        let footer_check_node = obj[obj.length - 1]
        if (image_data && image_data.lines && image_data.lines.length > 0 && parseInt(image_data.lines[0].x) < 170) {
            let margin = (parseInt(footer_check_node.y) - parseInt(image_data.lines[0].y)) / parseInt(footer_check_node.y)
            if (margin > 0 && margin * 100 < 12) {
                footer_available = true
                footer_coordinate = image_data.lines[0].y
            }
        }
        if (obj && obj.length > 0)
            bottom_px = parseInt(obj[obj.length - 1].y)
        obj.map((it, index) => {
            it.text = it.text.replace(/Digitally signed by.{1,}Reason:/gm, DIGITAL_SIGN_IDENTIFIER)
            it.text = it.text.replace(/Signature Not Verified/gm, DIGITAL_SIGN_IDENTIFIER)
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

            //Text in footer which is not common in all pages
            else if (footer_available && image_data && image_data.lines[0].y < it.y) {
                if (it.text.trim().length > 0) {
                    it.is_footer = true
                    if (previous_footer_node && ((parseInt(previous_footer_node.y) <= parseInt(it.y) && parseInt(it.y) <= parseInt(previous_footer_node.y) + parseInt(previous_footer_node.class_style['font-size'].split('px')[0])) || (parseInt(previous_footer_node.y) >= parseInt(it.y) && parseInt(it.y) + parseInt(it.class_style['font-size'].split('px')[0]) >= parseInt(previous_footer_node.y)))) {
                        let last_node = output[output.length - 1]
                        last_node.text += ' ' + it.text
                        output[output.length - 1] = last_node
                    } else {
                        output.push(it)
                    }
                    previous_footer_node = it
                }
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
                    } else {
                        is_super = true
                    }
                    // else if ((parseInt(previous_node.y_end) >= parseInt(it.y_end) && parseInt(it.y_end) + parseInt(it.class_style['font-size'].split('px')[0]) >= parseInt(previous_node.y_end))) {
                    //     is_super = true
                    // } else {
                    //     is_sub = true
                    // }
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

                if (style_map[class_identifier] && it.page_no_end - style_map[class_identifier].data.page_no_end <= 1 && !it.underline && !(previous_node && previous_node.visual_break == 1 && !(it.page_no - previous_node.page_no == 1 && it.node_index - previous_node.node_index <= 4))) {
                    let old_data = style_map[class_identifier]
                    let data = old_data.data
                    //If previous node class identifier is different than the current node then current node is a new sentence
                    if (change_style_map) {

                        style_map[class_identifier] = null
                        class_identifier = it.class_style['font-size'] + it.class_style['font-family'] + it.is_bold
                    }
                    data.text = data.text.trim()

                    if (!(version && it.page_no == 1 && it.node_index < 8) && (same_line || is_super || is_sub || (!(data.text.search(sentence_ends_regex) >= 0) || abbrivations2.indexOf(data.text.substring(data.text.length - 4, data.text.length).toLowerCase()) >= 0 || abbrivations3.indexOf(data.text.substring(data.text.length - 5, data.text.length).toLowerCase()) >= 0 || abbrivations4.indexOf(data.text.substring(data.text.length - 6, data.text.length).toLowerCase()) >= 0 || abbrivations6.indexOf(data.text.substring(data.text.length - 8, data.text.length).toLowerCase()) >= 0))) {
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
                            old_data.data.visual_break = it.visual_break
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
    let table_index = -1
    let table_page_no = -1
    let previous_footer = {}
    var out = output.filter((o, index) => {
        if (o.is_footer) {
            if (previous_footer && previous_footer.page_no == o.page_no) {
                if (isNaN(o.text.split(' ')[0])) {
                    output[index - 1].text = output[index - 1].text + ' ' + o.text
                    return false
                }
                previous_footer = o
            } else {
                previous_footer = o
            }
        }
        o.text = o.text.replace(/\s+/g, " ")
        // o.text = o.text.replace(/Digitally signed by.{1,}Reason:/gm, '')
        // o.text = o.text.replace(/Signature Not Verified/gm, '')
        // o.text = o.text.replace(DIGITAL_SIGN_IDENTIFIER, '')
        o.text = o.text.trim()
        if (o.is_table) {
            if (table_index == -1 || o.page_no != table_page_no) {
                table_index = index

                let table_item = {}
                Object.assign(table_item, o)
                let table_items = {}
                o.parent_table.rect.map((rect) => {
                    if (!table_items[rect.index[0]])
                        table_items[rect.index[0]] = {}
                    table_items[rect.index[0]][rect.index[1]] = { 'table_row': rect.index[0], 'table_column': rect.index[1], 'text': '', 'page_no': o.page_no, node_index: new Date().getTime() }
                })

                table_items[o.table_row][o.table_column] = table_item
                o.table_items = table_items
                o.text = ''
                table_page_no = o.page_no
                return true
            } else {
                let table_items = output[table_index].table_items
                if (table_items) {
                    if (table_items[o.table_row]) {
                        table_items[o.table_row][o.table_column] = o
                    }
                    else {
                        table_items[o.table_row] = {}
                        table_items[o.table_row][o.table_column] = o
                    }
                    output[table_index].table_items = table_items
                }
                return false
            }
        } else {
            table_index = -1
            table_page_no = -1
        }
        if (o.text.length > 0) {
            return true
        }
        return false
    })
    cb(null, out, header_text, footer_text)
}