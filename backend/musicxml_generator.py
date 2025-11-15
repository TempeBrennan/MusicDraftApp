# backend/musicxml_generator.py
# version 3.8 — MuseScore 3.1 compatible MusicXML generator (修正版 by ChatGPT)

import os
import io
import zipfile
import tempfile
import xml.etree.ElementTree as ET
from datetime import date


class StandardMusicXMLGenerator:
    """
    生成符合 MuseScore 3.1 标准的 MusicXML 或压缩 MXL 文件
    """

    def __init__(self, title="未命名作品", artist=""):
        self.title = title
        self.artist = artist
        self.measures = []  # 每个元素为小节字典

    # ---------------------------------------------------------
    # 工具函数
    # ---------------------------------------------------------
    def _txt(self, parent, name, text):
        """创建子节点并写入文本"""
        el = ET.SubElement(parent, name)
        el.text = str(text)
        return el

    def _pretty(self, elem):
        """将 XML Element 转为 bytes"""
        xml_bytes = ET.tostring(elem, encoding="utf-8", method="xml")
        return xml_bytes

    # ---------------------------------------------------------
    # 主体生成逻辑
    # ---------------------------------------------------------
    def create_xml(self):
        root = ET.Element("score-partwise", version="3.1")

        # ---- identification ----
        id_el = ET.SubElement(root, "identification")
        if self.artist:
            ET.SubElement(id_el, "creator", type="artist").text = self.artist

        enc = ET.SubElement(id_el, "encoding")
        self._txt(enc, "software", "MuseScore 2.2.1")
        self._txt(enc, "encoding-date", date.today().isoformat())
        for el_name, attr in [
            ("accidental", None),
            ("beam", None),
            ("print", "new-page"),
            ("print", "new-system"),
            ("stem", None),
        ]:
            args = {"element": el_name, "type": "yes"}
            if attr:
                args["attribute"] = attr
                args["value"] = "yes"
            ET.SubElement(enc, "supports", args)

        # ---- defaults ----
        defaults = ET.SubElement(root, "defaults")
        scaling = ET.SubElement(defaults, "scaling")
        self._txt(scaling, "millimeters", "7.05556")
        self._txt(scaling, "tenths", "40")
        page_layout = ET.SubElement(defaults, "page-layout")
        self._txt(page_layout, "page-height", "1584")
        self._txt(page_layout, "page-width", "1224")
        for t in ("even", "odd"):
            margins = ET.SubElement(page_layout, "page-margins", type=t)
            self._txt(margins, "left-margin", "56.6929")
            self._txt(margins, "right-margin", "56.6929")
            self._txt(margins, "top-margin", "56.6929")
            self._txt(margins, "bottom-margin", "113.386")
        word_font = ET.SubElement(defaults, "word-font")
        word_font.set("font-family", "FreeSerif")
        word_font.set("font-size", "10")
        lyric_font = ET.SubElement(defaults, "lyric-font")
        lyric_font.set("font-family", "FreeSerif")
        lyric_font.set("font-size", "11")

        # ---- credits ----
        credit_auth = ET.SubElement(root, "credit", page="1")
        ET.SubElement(
            credit_auth,
            "credit-words",
            {
                "default-x": "1167.31",
                "default-y": "1402.31",
                "justify": "right",
                "valign": "bottom",
                "font-size": "12",
            },
        ).text = f"原唱：{self.artist}" if self.artist else ""

        credit_title = ET.SubElement(root, "credit", page="1")
        ET.SubElement(
            credit_title,
            "credit-words",
            {
                "default-x": "612",
                "default-y": "1527.31",
                "justify": "center",
                "valign": "top",
                "font-size": "24",
            },
        ).text = self.title

        credit_bottom = ET.SubElement(root, "credit", page="1")
        ET.SubElement(
            credit_bottom,
            "credit-words",
            {
                "default-x": "612",
                "default-y": "113.386",
                "justify": "center",
                "valign": "bottom",
                "font-size": "8",
            },
        ).text = self.rights or ""

        # ---- part-list ----
        part_list = ET.SubElement(root, "part-list")
        score_part = ET.SubElement(part_list, "score-part", id="P1")
        self._txt(score_part, "part-name", "Piano")
        self._txt(score_part, "part-abbreviation", "Pno.")
        instr = ET.SubElement(score_part, "score-instrument", id="P1-I1")
        self._txt(instr, "instrument-name", "Piano")
        ET.SubElement(score_part, "midi-device", id="P1-I1", port="1")
        midi_inst = ET.SubElement(score_part, "midi-instrument", id="P1-I1")
        self._txt(midi_inst, "midi-channel", "1")
        self._txt(midi_inst, "midi-program", "1")
        self._txt(midi_inst, "volume", "78.7402")
        self._txt(midi_inst, "pan", "0")

        # ---- part content ----
        part = ET.SubElement(root, "part", id="P1")

        for i, m in enumerate(self.measures):
            # ✅ new-system 控制换行
            if m.get("new_system"):
                m_el = ET.SubElement(part, "measure", number=str(i + 1))
                print_el = ET.SubElement(m_el, "print", {"new-system": "yes"})
            else:
                m_el = ET.SubElement(part, "measure", number=str(i + 1))
                print_el = ET.SubElement(m_el, "print")

            layout = ET.SubElement(print_el, "system-layout")
            margins = ET.SubElement(layout, "system-margins")
            self._txt(margins, "left-margin", "-0.00")
            self._txt(margins, "right-margin", "853.07")
            self._txt(layout, "top-system-distance", "195.00")

            # ✅ 仅第一小节写属性（避免高音谱号重复）
            if i == 0:
                attr = ET.SubElement(m_el, "attributes")
                self._txt(attr, "divisions", "2")
                key = ET.SubElement(attr, "key")
                self._txt(key, "fifths", "0")
                time = ET.SubElement(attr, "time")
                self._txt(time, "beats", "4")
                self._txt(time, "beat-type", "4")
                clef = ET.SubElement(attr, "clef")
                self._txt(clef, "sign", "G")
                self._txt(clef, "line", "2")

                # ---- metronome ----
                direction = ET.SubElement(m_el, "direction", placement="above")
                dir_type = ET.SubElement(direction, "direction-type")
                metro = ET.SubElement(
                    dir_type,
                    "metronome",
                    {"parentheses": "no", "default-x": "-34.44", "default-y": "40.00"},
                )
                self._txt(metro, "beat-unit", "quarter")
                self._txt(metro, "per-minute", str(m.get("bpm", 120)))
                ET.SubElement(direction, "sound", tempo=str(m.get("bpm", 120)))

            # ---- notes ----
            for note_data in m.get("notes", []):
                note = ET.SubElement(m_el, "note")

                duration_val = int(note_data.get("duration", 2))
                note_type = note_data.get("xml_type", "quarter")

                if note_data.get("type") == "rest":
                    ET.SubElement(note, "rest")
                    self._txt(note, "duration", str(duration_val))
                    self._txt(note, "voice", "1")
                    self._txt(note, "type", note_type)

                else:
                    pitch = ET.SubElement(note, "pitch")
                    self._txt(pitch, "step", note_data.get("step", "C"))
                    if note_data.get("alter") not in (None, 0):
                        self._txt(pitch, "alter", str(note_data["alter"]))
                    self._txt(pitch, "octave", str(note_data.get("octave", 4)))

                    self._txt(note, "duration", str(duration_val))

                    # ✅ 在 voice/type/stem 之前处理 tie
                    tie_start = note_data.get("tie_start") or note_data.get("slur") == "start"
                    tie_stop = note_data.get("tie_stop") or note_data.get("slur") == "stop"
                    if tie_start:
                        ET.SubElement(note, "tie", {"type": "start"})
                    if tie_stop:
                        ET.SubElement(note, "tie", {"type": "stop"})

                    self._txt(note, "voice", "1")
                    self._txt(note, "type", note_type)
                    ET.SubElement(note, "stem").text = note_data.get("stem", "up")

                    # ✅ notations/tied 用于谱面显示
                    if tie_start or tie_stop:
                        notations = ET.SubElement(note, "notations")
                        if tie_start:
                            ET.SubElement(notations, "tied", {"type": "start"})
                        if tie_stop:
                            ET.SubElement(notations, "tied", {"type": "stop"})

        # ✅ 循环结束后返回完整 XML 树
        return root

    # ---------------------------------------------------------
    # 保存 XML / MXL 文件
    # ---------------------------------------------------------
    def save_xml(self, filename):
        root = self.create_xml()
        doc_type = (
            '<!DOCTYPE score-partwise PUBLIC '
            '"-//Recordare//DTD MusicXML 3.1 Partwise//EN" '
            '"http://www.musicxml.org/dtds/partwise.dtd">'
        )
        xml_str = self._pretty(root).decode("utf-8")
        lines = xml_str.split("\n")
        lines.insert(1, doc_type)
        with open(filename, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return filename

    def save_mxl(self, filename):
        """
        生成 .mxl 压缩包，内部的 score.xml 包含正确的 DOCTYPE
        """
        import shutil

        root = self.create_xml()
        doc_type = (
            '<!DOCTYPE score-partwise PUBLIC '
            '"-//Recordare//DTD MusicXML 3.1 Partwise//EN" '
            '"http://www.musicxml.org/dtds/partwise.dtd">'
        )

        xml_core = ET.tostring(root, encoding="utf-8", method="xml").decode("utf-8")
        final_output = f'<?xml version="1.0" encoding="UTF-8"?>\n{doc_type}\n{xml_core}'

        tmp_dir = tempfile.mkdtemp()
        score_path = os.path.join(tmp_dir, "score.xml")
        os.makedirs(os.path.join(tmp_dir, "META-INF"), exist_ok=True)
        container_path = os.path.join(tmp_dir, "META-INF", "container.xml")

        with open(score_path, "w", encoding="utf-8") as f:
            f.write(final_output)

        with open(container_path, "w", encoding="utf-8") as f:
            f.write("""<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>""")

        with zipfile.ZipFile(filename, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(score_path, "score.xml")
            zf.write(container_path, "META-INF/container.xml")

        shutil.rmtree(tmp_dir, ignore_errors=True)
        return filename