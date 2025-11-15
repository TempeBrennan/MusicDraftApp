let measures = [[]];

function updatePreview() {
  document.getElementById("preview").innerText =
    JSON.stringify(measures, null, 2);
}

document.getElementById("addNote").onclick = () => {
  const step = document.getElementById("step").value;
  const octave = parseInt(document.getElementById("octave").value);
  const [xml_type, duration] = ["quarter", 2];
  const lyric = document.getElementById("lyricText").value.trim();
  const beam = document.getElementById("beam").value || undefined;
  const slur = document.getElementById("slur").value || undefined;

  if (step === "R") measures.at(-1).push({ type: "rest", duration, xml_type });
  else
    measures.at(-1).push({
      type: "note",
      step,
      octave,
      duration,
      xml_type,
      lyric: lyric || undefined,
      beam,
      slur,
    });

  updatePreview();
};

document.getElementById("newMeasure").onclick = () => {
  measures.push([]);
  updatePreview();
};

async function exportFile(fmt) {
  const creators = {
    composer: document.getElementById("composer").value,
    lyricist: document.getElementById("lyricist").value,
    translator: document.getElementById("translator").value,
  };
  const rights = document.getElementById("rights").value;

  const body = {
    title: document.getElementById("title").value,
    creators,
    rights,
    measures: measures.map((m, i) => ({
      number: i + 1,
      bpm: 120,
      new_system: i % 5 === 0,
      notes: m,
    })),
  };

  const res = await fetch(`/generate?fmt=${fmt}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    alert("导出失败");
    return;
  }

  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${body.title}.${fmt}`;
  a.click();
}

document.getElementById("exportMXL").onclick = () => exportFile("mxl");