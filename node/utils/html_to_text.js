const htmlToJson = require('html-to-json')
const fs = require('fs');
var LOG = require('../logger/logger').logger
const sentence_ends_regex = /(([,|a-zA-Z|0-9|.]{3,}[.|?|!|\"|”|:]|([:][ ][-]))$)/g;
const reason_regex = /(([rR][e][a][s][o][n][:])$)/g;
const abbrivations2 = ['no.', 'mr.', 'ft.', 'kg.', 'dr.', 'ms.', 'st.', 'pp.', 'co.', 'rs.', 'sh.', 'vs.']
const abbrivations3 = ['pvt.', 'nos.', 'smt.', 'sec.', 'spl.', 'kgs.', 'ltd.', 'pty.', 'vol.', 'pty.', 'm/s.', 'mrs.']
const abbrivations4 = ['assn.']

exports.convertHtmlToJsonPagewise = function (basefolder, inputfilename, session_id, merge, pageno, start_node_index, cb) {
    fs.readFile(basefolder + session_id + "/" + inputfilename, 'utf8', function (err, data) {
        let output = []
        data = data.replace(/<br\/>/g, ' ')
        htmlToJson.parse(data, function () {
            var style_text = ''
            this.map('style', function ($item) {
                style_text += $item.toString()
            })
            var node_index = start_node_index
            return this.map('p', function ($item) {
                var is_bold = false
                if($item['0'].children){
                    $item['0'].children.map((child)=>{
                        if(child.name === 'b'){
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
                obj.text = $item.text()
                obj.style = style
                obj['class'] = class_identifier
                obj['page_no'] = pageno
                obj['is_bold'] = is_bold
                obj['page_no_end'] = pageno
                let class_style_text = style_text.split(obj['class'])[1].split('}')[0].split('{')[1]
                let class_style_obj = {}
                class_style_text = class_style_text.split(';')
                class_style_text.map((c) => {
                    class_style_obj[c.split(':')[0]] = c.split(':')[1]
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
                        data.text = data.text.replace(/Digitally signed by.{1,}Signature Not Verified/gm, '')
                    } else {
                        output.push(it)
                    }
                })
                cb(null, output)
            } else {
                cb(null, items)
            }
        }, function (err) {
            cb(err, null)
        });
    })
}


// exports.convertHtmlToJson = function (basefolder, inputfilename, session_id, cb) {
//     fs.readFile(basefolder + session_id + "/" + inputfilename, 'utf8', function (err, data) {
//         let output = []
//         let style_map = {}
//         data = data.replace(/<br\/>/g, ' ')
//         htmlToJson.parse(data, function () {
//             var style_text = ''
//             this.map('style', function ($item) {
//                 style_text += $item.toString()
//             })
//             var node_index = 1
//             var previous_page = 0
//             var pagewise_data = {}
//             this.map('p', function ($item) {
//                 let obj = {}
//                 let style = $item['0']['attribs']['style']
//                 let class_identifier = $item['0']['attribs']['class']
//                 let styles = style.split(';')
//                 styles.map((s) => {
//                     let topLeft = s.split(':')
//                     if (topLeft[0] == 'left') {
//                         obj.x = topLeft[1].split('px')[0]
//                     } else if (topLeft[0] == 'top') {
//                         obj.y = topLeft[1].split('px')[0]
//                     }
//                 })
//                 obj.text = $item.text()
//                 obj.style = style
//                 obj['class'] = class_identifier
//                 obj['page_no'] = parseInt(class_identifier.split('ft')[1] / 10)
//                 obj['page_no_end'] = parseInt(class_identifier.split('ft')[1] / 10)
//                 if (previous_page !== obj['page_no_end']) {
//                     previous_page = obj['page_no_end']
//                     node_index = 1
//                 }
//                 let class_style_text = style_text.split(obj['class'])[1].split('}')[0].split('{')[1]
//                 let class_style_obj = {}
//                 class_style_text = class_style_text.split(';')
//                 class_style_text.map((c) => {
//                     class_style_obj[c.split(':')[0]] = c.split(':')[1]
//                 })
//                 obj['class_style'] = class_style_obj
//                 obj.node_index = node_index
//                 node_index++
//                 if (pagewise_data[obj['page_no']]) {
//                     let data = pagewise_data[obj['page_no']]
//                     data.push(obj)
//                 } else {
//                     let data = [obj]
//                     pagewise_data[obj['page_no']] = data
//                 }

//             });
//             return pagewise_data;
//         }).done(function (items) {
//             //Find header or footer
//             let header_end_index = -1
//             let footer_start_index = -1
//             let footer_text = ''
//             Object.keys(items).forEach(function (key, index) {
//                 if (index != 0) {
//                     let obj = items[key]
//                     let obj_prev = items[key - 1]
//                     let obj_next = items[key + 1]
//                     let obj_to_check = obj_next ? obj_next : obj_prev
//                     let current_header_end_index = -1
//                     let current_footer_start_index = -1
//                     if (obj_to_check) {
//                         obj.map((it, index) => {
//                             if (current_header_end_index == -1 || index - current_header_end_index == 1) {
//                                 if (obj_to_check[index] && obj_to_check[index].text === obj[index].text) {
//                                     current_header_end_index = index
//                                 }
//                             }
//                         })
//                         obj.slice(0).reverse().map((it, index) => {
//                             if (current_footer_start_index == -1 || index - current_footer_start_index == 1) {
//                                 if (obj_to_check[obj_to_check.length - index - 1] && obj_to_check[obj_to_check.length - index - 1].text === it.text) {
//                                     current_footer_start_index = index
//                                     footer_text = it.text
//                                 }
//                             }
//                         })
//                     }
//                     if (header_end_index !== -1 && header_end_index !== current_header_end_index) {
//                         header_end_index = -1
//                     } else {
//                         header_end_index = current_header_end_index
//                     }
//                     if (footer_start_index !== -1 && footer_start_index !== current_footer_start_index) {
//                         footer_start_index = -1
//                         footer_text = ''
//                     } else {
//                         footer_start_index = current_footer_start_index
//                     }
//                 }
//             })
//             Object.keys(items).forEach(function (key, index) {
//                 let obj = items[key]
//                 obj.map((it, index) => {
//                     if (it.text == it.page_no) {
//                         return
//                     }
//                     if (header_end_index !== -1 && index <= header_end_index) {
//                         return
//                     }
//                     if ((footer_start_index !== -1 && index >= obj.length - footer_start_index - 1) || key == 1 && it.text === footer_text) {
//                         return
//                     }
//                     let class_identifier = it.class_style['font-size'] + it.class_style['font-family']
//                     if (output && output.length > 0) {
//                         let data = output[output.length - 1]
//                         // if ((data.y == it.y || !(sentence_ends.indexOf(data.text.substring(data.text.length - 1, data.text.length)) >= 0 && data.text.search(regex) >= 0)) && data.class_style === it.class_style) {
//                         //     data.text += ' ' + it.text
//                         //     data.text = data.text.replace(/\s+/g, " ")
//                         // } else {
//                         if (style_map[class_identifier] && it.page_no_end - style_map[class_identifier].data.page_no_end <= 1) {
//                             let old_data = style_map[class_identifier]
//                             let data = old_data.data
//                             data.text = data.text.trim()
//                             if ((!(data.text.search(sentence_ends_regex) >= 0) || abbrivations2.indexOf(data.text.substring(data.text.length - 3, data.text.length).toLowerCase()) >= 0 || abbrivations3.indexOf(data.text.substring(data.text.length - 4, data.text.length).toLowerCase()) >= 0 || abbrivations4.indexOf(data.text.substring(data.text.length - 5, data.text.length).toLowerCase()) >= 0) && it.node_index - data.node_index <= 5) {
//                                 if ((previous_node && previous_node.text_completed) || (it.node_index - data.node_index > 2 && it.page_no - style_map[class_identifier].data.page_no == 0)) {
//                                     output.push(it)
//                                     it.text_completed = true
//                                     style_map[class_identifier] = { index: output.length - 1, data: it }
//                                 } else {
//                                     old_data.data.text += " " + it.text.replace(/\s+/g, " ")
//                                     old_data.data.node_index = it.node_index
//                                     old_data.data.page_no_end = it.page_no_end
//                                     output[old_data.index] = old_data.data
//                                     style_map[class_identifier] = old_data
//                                 }
//                             } else {
//                                 output.push(it)
//                                 it.text_completed = true
//                                 style_map[class_identifier] = { index: output.length - 1, data: it }
//                             }
//                         } else {
//                             output.push(it)
//                             it.text_completed = true
//                             style_map[class_identifier] = { index: output.length - 1, data: it }
//                         }
//                         // }
//                     } else {
//                         output.push(it)
//                         it.text_completed = true
//                         style_map[class_identifier] = { index: output.length - 1, data: it }
//                     }
//                 })
//             })
//             var out = output.filter((o) => {
//                 o.text = o.text.replace(/\s+/g, " ")
//                 o.text = o.text.replace(/Digitally signed by.{1,}Signature Not Verified/gm, '')
//                 if (o.text != o.page_no && o.text.length > 0) {
//                     return true
//                 }
//                 return false
//             })
//             cb(null, out)
//         }, function (err) {
//             cb(err, null)
//         });
//     })
// }


exports.mergeHtmlNodes = function (items, cb) {
    let output = []
    let style_map = {}
    //Find header or footer
    let header_end_index = -1
    let footer_start_index = -1
    let page_no_start_index = -1
    let page_no_end_index = -1
    let page_no_text = ''
    let footer_text = ''
    let previous_node = null
    let change_style_map = false
    Object.keys(items).forEach(function (key, index) {
        if (index != 0) {
            let obj = items[key]
            let obj_prev = items[key - 1]
            let obj_next = items[key + 1]
            let obj_to_check = obj_next ? obj_next : obj_prev
            let current_header_end_index = -1
            let current_footer_start_index = -1
            let current_page_no_start_index = -1
            let current_page_no_end_index = -1
            if (obj_to_check) {
                obj.map((it, index) => {
                    if (current_header_end_index == -1 || index - current_header_end_index == 1) {
                        if (obj_to_check[index] && obj_to_check[index].text === obj[index].text && obj[index].text.trim().length > 0) {
                            current_header_end_index = index
                        }
                    }
                    if (obj_to_check[index]) {
                        let current_text = it.text.replace(/\d+/g, '');
                        current_text = current_text.replace(/\s+/g, '')
                        if (current_text.length > 0) {
                            let next_text = obj_to_check[index].text.replace(/\d+/g, '');
                            next_text = next_text.replace(/\s+/g, '')
                            if (next_text === current_text && current_text.trim().length > 0 && index !== current_header_end_index) {
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
                            if (next_text === current_text && index !== current_footer_start_index && current_text.trim().length > 0) {
                                current_page_no_end_index = index
                                page_no_text = next_text
                            }
                        }
                    }
                })
            }
            if (header_end_index !== -1 && header_end_index !== current_header_end_index) {
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
                page_no_start_index = current_page_no_start_index
            }
            if (page_no_end_index !== -1 && page_no_end_index !== current_page_no_end_index) {
                page_no_end_index = -1
            } else {
                page_no_end_index = current_page_no_end_index
            }
        }
    })
    Object.keys(items).forEach(function (key, index) {
        let obj = items[key]
        obj.map((it, index) => {
            if (it.text == it.page_no) {
                return
            }
            if ((page_no_start_index !== -1 && index === page_no_start_index) || (page_no_end_index !== -1 && index === obj.length - page_no_end_index - 1) || (key == 1 && it.text.replace(/\d+/g, '').replace(/\s+/g, '') === page_no_text)) {
                return
            }
            if (header_end_index !== -1 && index <= header_end_index) {
                return
            }
            if ((footer_start_index !== -1 && index >= obj.length - footer_start_index - 1) || key == 1 && it.text === footer_text) {
                return
            }
            let class_identifier = it.class_style['font-size'] + it.class_style['font-family'] + it.is_bold
            if (output && output.length > 0) {
                let data = output[output.length - 1]
                // if ((data.y == it.y || !(sentence_ends.indexOf(data.text.substring(data.text.length - 1, data.text.length)) >= 0 && data.text.search(regex) >= 0)) && data.class_style === it.class_style) {
                //     data.text += ' ' + it.text
                //     data.text = data.text.replace(/\s+/g, " ")
                // } else {


                if (!style_map[class_identifier] && previous_node.page_no === it.page_no && previous_node && ((previous_node.y >= it.y && parseInt(it.y) - parseInt(it.class_style['font-size'].split('px')[0]) >= parseInt(previous_node.y) - parseInt(previous_node.class_style['font-size'].split('px')[0])) || (previous_node.y <= it.y && parseInt(it.y) - parseInt(it.class_style['font-size'].split('px')[0]) <= parseInt(previous_node.y) - parseInt(previous_node.class_style['font-size'].split('px')[0]))) && it.text.trim().length > 0) {
                    class_identifier = previous_node.class_style['font-size'] + previous_node.class_style['font-family'] + previous_node.is_bold
                    change_style_map = true
                }
                if(previous_node && class_identifier !== previous_node.class_style['font-size'] + previous_node.class_style['font-family'] + previous_node.is_bold){
                    style_map[previous_node.class_style['font-size'] + previous_node.class_style['font-family'] + previous_node.is_bold] = null
                }
                if (style_map[class_identifier] && it.page_no_end - style_map[class_identifier].data.page_no_end <= 1) {
                    let old_data = style_map[class_identifier]
                    let data = old_data.data
                    if (change_style_map) {
                        style_map[class_identifier] = null
                        class_identifier = it.class_style['font-size'] + it.class_style['font-family'] + it.is_bold
                    }
                    data.text = data.text.trim()
                    if ((!((data.text.search(sentence_ends_regex) >= 0 && data.text.search(reason_regex) < 0)) || abbrivations2.indexOf(data.text.substring(data.text.length - 3, data.text.length).toLowerCase()) >= 0 || abbrivations3.indexOf(data.text.substring(data.text.length - 4, data.text.length).toLowerCase()) >= 0 || abbrivations4.indexOf(data.text.substring(data.text.length - 5, data.text.length).toLowerCase()) >= 0) && it.node_index - data.node_index <= 10) {
                        if ((previous_node && previous_node.text_completed) || ((it.node_index - data.node_index > 2 && it.page_no - old_data.data.page_no == 0) || (it.node_index - data.node_index > 8 && it.page_no - old_data.data.page_no == 1))) {
                            output.push(it)
                            style_map[class_identifier] = { index: output.length - 1, data: it }
                        } else {
                            old_data.data.text += " " + it.text.replace(/\s+/g, " ")
                            old_data.data.node_index = it.node_index
                            old_data.data.page_no_end = it.page_no_end
                            output[old_data.index] = old_data.data
                            style_map[class_identifier] = old_data
                        }
                    }
                    else {
                        output.push(it)
                        style_map[class_identifier] = { index: output.length - 1, data: it }
                    }
                } else {
                    output.push(it)
                    style_map[class_identifier] = { index: output.length - 1, data: it }
                }
                // }
            } else {
                output.push(it)
                style_map[class_identifier] = { index: output.length - 1, data: it }
            }
            change_style_map = true
            previous_node = it
        })
    })
    var out = output.filter((o) => {
        o.text = o.text.replace(/\s+/g, " ")
        o.text = o.text.replace(/Digitally signed by.{1,}Signature Not Verified/gm, '')
        o.text = o.text.trim()
        if (o.text != o.page_no && o.text.length > 0) {
            return true
        }
        return false
    })
    cb(null, out)
}