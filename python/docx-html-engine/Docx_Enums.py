from enum import Enum


class DocumentPart(Enum):
    Document = "word/document.xml"
    Style = "word/styles.xml"
    Numbering = "word/numbering.xml"
    FontTable = "word/fontTable.xml"
    Settings = "word/settings.xml"
    DocumentRelations = "word/_rels/document.xml.rels"
    NumberingRelations = "word/_rels/numbering.xml.rels"
    FontRelations = "word/_rels/fontTable.xml.rels"
    EndNotes = "word/endnotes.xml"
    docx_xml = "docx_xml"
    settings_xml = "settings_xml"
    numbering_xml = "numbering_xml"
    style_xml = "style_xml"
    fonttable_xml = "fonttable_xml"
    docx_rel_xml = "docx_rel_xml"
    font_rel_xml = "font_rel_xml"
    num_rel_xml = "num_rel_xml"
    word_schema = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    tag_t = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'
    tag_body = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}body'
    tag_para = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'
    tag_table = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl'
    tag_sectPr = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sectPr'
    tag_relationship = '{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'
    tag_styles = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}styles'
    tag_style = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}style'
    tag_docDefaults = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}docDefaults'
    tag_rPrDefaults = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPrDefault'
    tag_pPrDefaults = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPrDefault'
    tag_rPr = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr'
    tag_pPr = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr'
    tag_jc = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}jc'
    tag_textAlignment = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}textAlignment'
    tag_color = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}color'
    tag_sz = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz'
    tag_shd = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}shd'
    tag_highlight = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}highlight'
    tag_tcW = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tcw'
    tag_tblW = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblW'
    tag_trHeight = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}trHeight'
    tag_strike = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}strike'
    tag_b = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}b'
    tag_i = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}i'
    tag_u = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}u'
    tag_ind = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ind'
    tag_rFonts = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rFonts'
    tag_tblBorders = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblBorders'
    tag_tblCellSpacing = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tableCellSpacing'
    tag_pBdr = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pBdr'
    tag_tcBorders = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tcBorders'
    tag_noWrap = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}noWrap'
    tag_tableCellMar = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tableCellMar'
    tag_tcMar = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tcMar'
    tag_tblLayout = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblLayout'
    tag_vAlign = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}vAlign'
    tag_spacing = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}scpaing'
    tag_lang = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}lang'
    tag_noProof = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}noProof'
    tag_webHidden = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}webHidden'
    tag_val = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val'
    tag_fill = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill'
    tag_type = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}type'
    tag_w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w'
    tag_hRule = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hRule'
    tag_firstLine = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}firstLine'
    tag_left = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}left'
    tag_start = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}start'
    tag_right = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}right'
    tag_end = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}end'
    tag_ascii = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii'
    tag_top = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top'
    tag_bottom = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bottom'
    tag_before = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}before'
    tag_after = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}after'
    tag_line = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}line'
    tag_styleId = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}styleId'
    tag_default = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}default'
    tag_basedOn = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}basedOn'
    tag_name = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}name'
    tag_tcPr = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tcPr'
    tag_tblStylePr = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblStylePr'
    tag_abstractNum = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}abstractNum'
    tag_abstractNumId = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}abstractNumId'
    tag_lvl = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}lvl'
    tag_ilvl = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ilvl'
    tag_lvlPicBulletId = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}lvlPicBulletId'
    tag_lvlText = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}lvlText'
    tag_numFmt = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numFmt'
    tag_numPicBullet = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numPicBullet'
    tag_pict = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pict'
    tag_shape = '{urn:schemas-microsoft-com:vml}shape'
    tag_imagedata = '{urn:schemas-microsoft-com:vml}imagedata'
    tag_numPicBulletId = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numPicBulletId'
    tag_num = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}num'
    tag_numId = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numId'


class DefaultProps(Enum):
    shd = "white"
    color = "black"
    highlight = "transparent"


class SizeType(Enum):
    Dxa = 'Dxa'
    FontSize = 'FontSize'
    Border = 'Border'
    Percent = 'Percent'

    def convertSize(val, type_=Dxa):
        val = str(val)
        if val is None or val.find('pt') > -1:
            return val
        int_val = int(val)
        if type_ == SizeType.Dxa.value:
            result = (0.05 * int_val)
            return (str)("{:.2f}".format(result)) + 'pt'
        elif type_ == SizeType.FontSize.value:
            result = (0.5 * int_val)
            return (str)("{:.2f}".format(result)) + 'pt'
        elif type_ == SizeType.Border.value:
            result = (0.125 * int_val)
            return (str)("{:.2f}".format(result)) + 'pt'

        elif type_ == SizeType.Percent.value:
            result = (0.02 * int_val)
            return (str)("{:.2f}".format(result)) + 'pt'
        elif type_ == SizeType.Emu.value:
            result = (int_val / 12700)
            return (str)("{:.2f}".format(result)) + 'pt'

        return val
