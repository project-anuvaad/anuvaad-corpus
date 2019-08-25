import logging as log

from Docx_Enums import SizeType
from Docx_Enums import DocumentPart
from document_classes import *
from Docx_Enums import DefaultProps as DEFAULTS


def valueOfSize(node, attrName, attr):
    type_ = SizeType.Dxa.value
    val = node.attrib[DocumentPart.tag_type.value]
    if val == 'pct':
        type_ = SizeType.Percent.value

    return sizeAttr(node, attrName, type_)


def sizeAttr(node, attrname, type=SizeType.Dxa.value):
    val = None
    try:
        val = node.attrib[attrname]
        if val is not None:
            return SizeType.convertSize(val, type)
        else:
            return None
    except:
        return None


def parseTrHeight(node):
    val = node.attrib[DocumentPart.tag_hRule.value]
    return sizeAttr(node, DocumentPart.tag_val.value)


def valueOfStrike(node):
    val = boolAttr(node, DocumentPart.tag_val, True)
    if val is not None:
        return 'line-through'
    return 'none'


def boolAttr(node, attrName, defValue=False):
    val = None
    try:
        val = node.attrib[attrName]
    except:
        pass

    if val is not None:
        if str(val) == "1":
            return True
        elif str(val) == "0":
            return False
    else:
        return defValue


def valueOfBold(node):
    val = boolAttr(node, DocumentPart.tag_val, True)
    if val is None or val is False:
        return 'normal'
    elif val:
        return 'bold'


def colorAttr(node, attrName, autoColor='black'):
    v = node.attrib[attrName]
    if v is None:
        return v
    elif v == 'yellow':
        return v
    elif v == 'auto':
        return autoColor
    # return v ? `#${v}` : defValue;
    return v


def parseUnderline(node, style):
    val = node.attrib[DocumentPart.tag_val]
    if val is None or val == 'none':
        return
    if val == 'dotDotDash':
        style['text-decoration-style'] = 'dashed'
    elif val == 'dottedHeavy':
        style['text-decoration-style'] = 'dotted'
    elif val == 'double':
        style['text-decoration-style'] = 'double'
    elif val == 'thick':
        style['text-decoration-style'] = 'underline'
    elif val == 'wavyHeavy':
        style['text-decoration-style'] = 'wavy'
    elif val == 'words':
        style['text-decoration'] = 'underline'
    # some of the cases have been left ,
    # following are the cases : "dash","dashDotDotHeavy","dashDotHeavy","dashedHeavy","dashLong","dashLongHeavy"
    # "dotDash","dotDotDash", "dotted", "single", "wave","wavyDouble"

    color = colorAttr(node, DocumentPart.tag_color.value)
    if color is not None:
        style['text-decoration-color'] = color


def parseIndentation(node, style):
    firstline = sizeAttr(node, DocumentPart.tag_firstLine.value)
    left = sizeAttr(node, DocumentPart.tag_left.value)
    start = sizeAttr(node, DocumentPart.tag_start.value)
    right = sizeAttr(node, DocumentPart.tag_right.value)
    end = sizeAttr(node, DocumentPart.tag_end.value)

    if firstline is not None:
        style['text-indent'] = firstline
    if left is not None:
        style['margin-left'] = left
    elif start is not None:
        style['margin-left'] = start
    if right is not None:
        style['margin-right'] = right
    elif end is not None:
        style['margin-right'] = end


def parseFont(node, style):
    ascii_ = node.attrib[DocumentPart.tag_ascii.value]

    if ascii_ is not None:
        style['font-family'] = ascii_


def valueOfBorder(node):
    type_ = node.attrib[DocumentPart.tag_val.value]
    if type_ == "nil":
        return "none";

    color = node.attrib[DocumentPart.tag_color.value]
    size = sizeAttr(node, DocumentPart.tag_sz.value, SizeType.Border.value)
    if color == 'auto':
        color = 'black'

    return str(size) + ' solid ' + color


def parseBorderProperties(node, style):
    for child in node.iterchildren():
        if child.tag == DocumentPart.tag_left.value:
            style['border-left'] = valueOfBorder(child)  ##following tags have been not implemented yet : start,end,
        elif child.tag == DocumentPart.tag_right.value:
            style['border-right'] = valueOfBorder(child)
        elif child.tag == DocumentPart.tag_top.value:
            style['border-top'] = valueOfBorder(child)
        elif child.tag == DocumentPart.tag_bottom.value:
            style['border-bottom'] = valueOfBorder(child)


def valueOfMargin(node):
    return sizeAttr(node, DocumentPart.tag_w.value)


def parseMarginProperties(node, style):
    for child in node.iterchildren():
        if child.tag == DocumentPart.tag_left.value:
            style['padding-left'] = valueOfMargin(child)
        elif child.tag == DocumentPart.tag_right.value:
            style['padding-right'] = valueOfMargin(child)
        elif child.tag == DocumentPart.tag_top.value:
            style['padding-top'] = valueOfMargin(child)
        elif child.tag == DocumentPart.tag_bottom.value:
            style['padding-bottom'] = valueOfMargin(child)


def valueOfTblLayout(node):
    type = node.attrib[DocumentPart.tag_val.value]
    if type == 'fixed':
        return 'fixed'
    return 'auto'


def parseSpacing(node, style):
    before = sizeAttr(node, DocumentPart.tag_before.value)
    after = sizeAttr(node, DocumentPart.tag_after.value)
    line = sizeAttr(node, DocumentPart.tag_line.value)

    if before is not None:
        style['margin-top'] = before
    if after is not None:
        style['margin-bottom'] = after
    if line is not None:
        style['line-height'] = line
        style['min-height'] = line


def parse_default_properties(node):
    style = {}
    for x in node.iterchildren():

        if x.tag == DocumentPart.tag_jc.value:
            style['text_align'] = x.attrib[DocumentPart.tag_jc.value]
        elif x.tag == DocumentPart.tag_textAlignment.value:
            style['vertical-align'] = x.attrib[DocumentPart.tag_textAlignment.value]
        elif x.tag == DocumentPart.tag_color.value:
            if x.attrib[DocumentPart.tag_val] is None:
                style['color'] = DEFAULTS.color.value
            else:
                style['color'] = x.attrib[DocumentPart.tag_val.value]
        elif x.tag == DocumentPart.tag_sz.value:
            style['font-size'] = SizeType.convertSize(x.attrib[DocumentPart.tag_val.value], SizeType.FontSize.value)
        elif x.tag == DocumentPart.tag_shd.value:
            style['background-color'] = colorAttr(x, DocumentPart.tag_fill.value, DEFAULTS.shd.value)
        elif x.tag == DocumentPart.tag_highlight.value:
            style['background-color'] = colorAttr(x, DocumentPart.tag_val.value, DEFAULTS.highlight.value)
        elif x.tag == DocumentPart.tag_tcW.value:
            break  # if (this.ignoreWidth) nothing was returned
        elif x.tag == DocumentPart.tag_tblW.value:
            style['width'] = valueOfSize(x, DocumentPart.tag_w.value)
        elif x.tag == DocumentPart.tag_trHeight:
            style['trHeight'] = parseTrHeight(x)
        elif x.tag == DocumentPart.tag_strike.value:
            style['text-decoration'] = valueOfStrike(x)
        elif x.tag == DocumentPart.tag_b.value:
            style['font-weight'] = valueOfBold(x)
        elif x.tag == DocumentPart.tag_i.value:
            style['font-style'] = 'italic'
        elif x.tag == DocumentPart.tag_u.value:
            x.Values.parseUnderLine(x, style)
        elif x.tag == DocumentPart.tag_ind.value:
            parseIndentation(x, style)
        elif x.tag == DocumentPart.tag_rFonts.value:
            parseFont(x, style)
        elif x.tag == DocumentPart.tag_tblBorders.value:
            parseBorderProperties(x, style)
        elif x.tag == DocumentPart.tag_tblCellSpacing.value:
            style['border-spacing'] = valueOfMargin(x)
            style['border-collapse'] = 'separate'
        elif x.tag == DocumentPart.tag_pBdr.value:
            parseBorderProperties(x, style)
        elif x.tag == DocumentPart.tag_tcBorders.value:
            parseBorderProperties(x, style)
        elif x.tag == DocumentPart.tag_noWrap.value:
            """TODO: 
            style['white-space'] = 'nowrap' 
            following are not impl : tblCellMar, lang , noproof,webHidden,pPr"""
        elif x.tag == DocumentPart.tag_tcMar.value:
            parseMarginProperties(x, style)
        elif x.tag == DocumentPart.tag_tblLayout.value:
            style['table-layout'] = valueOfTblLayout(x)
        elif x.tag == DocumentPart.tag_vAlign.value:
            style['vertical-align'] = x.atrrib[DocumentPart.tag_val.value]
        elif x.tag == DocumentPart.tag_spacing.value:
            parseSpacing(x, style)
    return style


def className(node, attribute):
    """val && val.replace(/[ .]+/g, '-').replace(/[&]+/g, 'and') """
    return node.attrib[attribute]


def parseTableStyle(node):
    result = []
    type_ = node.attrib[DocumentPart.tag_type.value]
    selector = ''

    if type_ == 'firstRow':
        selector = "tr.first-row td"
    if type_ == 'lastRow':
        selector = "tr.last-row td"
    if type_ == 'firstCol':
        selector = "td.first-col"
    if type_ == 'lastCol':
        selector = "td.last-col"
    if type_ == 'band1Vert':
        selector = "td.odd-col"
    if type_ == 'band2Vert':
        selector = "td.even-col"
    if type_ == 'band1Horz':
        selector = "tr.odd-row"

    for x in node.iterchildren():
        if x.tag == DocumentPart.tag_pPr.value:
            sub = SubStyle()
            sub.target = selector + " p"
            sub.values = parse_default_properties(x)
            result.append(sub)
        elif x.tag == DocumentPart.tag_rPr.value:
            sub = SubStyle()
            sub.target = selector + " span"
            sub.values = parse_default_properties(x)
            result.append(sub)
        elif x.tag == DocumentPart.tag_tcPr.value:
            sub = SubStyle()
            sub.target = selector
            sub.values = parse_default_properties(x)
            result.append(sub)

        return result;


def parseStyle(node):
    result = Style()
    result.id = className(node, DocumentPart.tag_styleId.value)
    result.isDefault = boolAttr(node, DocumentPart.tag_default.value)
    val = node.attrib[DocumentPart.tag_type.value]
    if val == 'paragraph':
        result.target = 'p'
    elif val == 'table':
        result.target = 'table'
    elif val == 'span':
        result.target = 'span'

    for x in node.iterchildren():
        if x.tag == DocumentPart.tag_basedOn.value:
            result.basedOn = x.attrib[DocumentPart.tag_val.value]
        elif x.tag == DocumentPart.tag_name.value:
            result.name = x.attrib[DocumentPart.tag_val.value]
        elif x.tag == DocumentPart.tag_pPr.value:
            sub = SubStyle()
            sub.target = 'p'
            sub.values = parse_default_properties(x)
            result.styles.append(sub)
        elif x.tag == DocumentPart.tag_tcPr.value:
            """tblPr, "rsid","qFormat","hidden","semiHidden","unhideWhenUsed","autoRedefine","uiPriority":is not 
            implemented """
            sub = SubStyle()
            sub.target = 'td'
            sub.values = parse_default_properties(x)
            result.styles.append(sub)
        elif x.tag == DocumentPart.tag_tblStylePr.value:
            res = parseTableStyle(x)
            for s in res:
                result.styles.append(s)
    return result


def parse_default_style(node):
    log.info('parse_default_style : started')
    result = Style()
    for child in node.iterchildren():
        if child.tag == DocumentPart.tag_rPrDefaults.value:
            for x in child.iterchildren():
                if x.tag == DocumentPart.tag_rPr.value:
                    sub_styles = SubStyle()
                    sub_styles.target = 'span'
                    sub_styles.values = parse_default_properties(x)
                    result.styles.append(sub_styles)
        elif child.tag == DocumentPart.tag_pPrDefaults.value:
            for x in child.iterchildren():
                if x.tag == DocumentPart.tag_pPr.value:
                    sub_styles = SubStyle()
                    sub_styles.target = 'p'
                    sub_styles.value = parse_default_properties(x)
                    result.styles.append(sub_styles)
        log.info('parse_default_style : ended')
        return result


def intAttr(node, attrname, defvalue=0):
    val = node.attrib[attrname]
    try:
        return int(val)
    except:
        return 0


def parseNumberingLevel(_id, node, bullets):
    result = Numbering()
    result.id = _id
    result.level = intAttr(node, DocumentPart.tag_ilvl.value)
    result.style = {}

    for n in node.iterchildren():
        if n.tag == DocumentPart.tag_pPr.value:
            result.style = parse_default_properties(n)
        elif n.tag == DocumentPart.tag_lvlPicBulletId.value:
            val = intAttr(n, DocumentPart.tag_val.value)
            for bul in bullets:
                if bul.id == val:
                    result.bullet = bul
                    ''' impl can be improved '''
                    break
        elif n.tag == DocumentPart.tag_lvlText.value:
            result.levelText = n.attrib[DocumentPart.tag_val.value]
        elif n.tag == DocumentPart.tag_numFmt.value:
            result.format = n.attrib[DocumentPart.tag_val.value]
    return result


def parseAbstractNumbering(node, bullets):
    result = []
    id_ = node.attrib[DocumentPart.tag_abstractNumId.value]
    for n in node.iterchildren():
        if n.tag == DocumentPart.tag_lvl.value:
            result.append(parseNumberingLevel(id_, n, bullets))

    return result


def parseNumberingPicBullet(node):
    pict = None
    shape = None
    imagedata = None
    result = {}
    for n in node.iterchildren():
        if n.tag == DocumentPart.tag_pict.value:
            pict = n
            break
    if pict is not None:
       for x in pict.iterchildren():
            if x.tag == DocumentPart.tag_shape.value:
                shape = pict and  x
                break
       for x in shape.iterchildren():
            if x.tag == DocumentPart.tag_imagedata.value:
                imagedata = shape and x
                break
    if imagedata is not None:
        result = NumberingPicBullet()
        result.id = node.attrib[DocumentPart.tag_numPicBullet.value]
        result.src = imagedata.attrib[DocumentPart.tag_id.value]
        result.style = shape.attrib[DocumentPart.tag_style.value]
        return result
    return None


def elementStringAttr(node, node_name,attrname):
    for n in node.iterchildren():
        if n.tag == node_name:
            return n.attrib[attrname]
    return None
