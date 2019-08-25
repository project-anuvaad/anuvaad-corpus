class DocRel:
    def __init__(self, id, type, target, targetMode=""):
        self.id = id
        self.type = type
        self.target = target
        self.targetMode = targetMode


class Document:
    def __init__(self):
        self.docRelations = []
        self.fontRelations = []
        self.numRelations = []
        self.styles = []
        self.fonts = []
        self.numbering = []
        self.document = None


class Style:
    def __init__(self):
        self.id = None
        self.name = None
        self.target = None
        self.basedOn = None
        self.isDefault = None
        self.styles = []


class SubStyle:
    def __init__(self):
        self.target = None
        self.values = None  # styleValues


class StyleValues:
    def __init__(self, name, value):
        self.name = name
        self.value = value

    def getStyleValues(self):
        return self.name + ':' + self.lvalue


class Numbering:
    def __init__(self):
        self.id = None
        self.level = None
        self.style = None
        self.levelText = None
        self.format = None
        self.bullet = None


class NumberingPicBullet:
    def __init__(self):
        self.id = None
        self.src = None
        self.style = None


