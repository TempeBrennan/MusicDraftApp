from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import tempfile, os, uuid
from .musicxml_generator import StandardMusicXMLGenerator

app = FastAPI(title="SimpleNote to XML v3.6")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- 数据模型 ----------
class NoteData(BaseModel):
    type: str = "note"
    step: str | None = None
    alter: int | None = 0
    octave: int | None = 4
    duration: int = 2
    xml_type: str = "quarter"
    stem: str = "up"
    beam: str | None = None
    slur: str | None = None
    lyric: str | None = None

class Measure(BaseModel):
    number: int | None = None
    bpm: int | None = 120
    new_system: bool = False
    divisions: int = 2
    harmony: list[dict] = []
    notes: list[NoteData]

class ScoreRequest(BaseModel):
    title: str
    artist: str = ""
    measures: list[Measure]

# ---------- 生成 XML ----------
@app.post("/generate")
def generate_xml(data: ScoreRequest):
    generator = StandardMusicXMLGenerator(
        title=data.title, artist=data.artist
    )
    generator.measures = [m.dict() for m in data.measures]

    tmp_name = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.mxl")
    generator.save_mxl(tmp_name)

    with open(tmp_name, "rb") as f:
        content = f.read()
    os.remove(tmp_name)

    from urllib.parse import quote
    encoded_name = quote(f"{data.title}.mxl")

    return Response(
        content=content,
        media_type="application/vnd.recordare.musicxml+zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}"},
    )

# ---------- 静态文件 ----------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")