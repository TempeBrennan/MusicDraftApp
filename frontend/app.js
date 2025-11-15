// ---------- 数据结构 ----------
const Editor = {
  measures: [[]],
  selected: null,
};

// ---------- 工具函数 ----------
const durName = d => ({ 0.5: "16th", 1: "eighth", 2: "quarter", 4: "half", 8: "whole" }[d] || "quarter");
const pitchToNum = s => ({ C: "1", D: "2", E: "3", F: "4", G: "5", A: "6", B: "7" }[s] || "?");

// ---------- 渲染函数 ----------
function renderScore() {
  const area = document.getElementById('score-area');
  area.innerHTML = "";
  Editor.measures.forEach((m, mi) => {
    const mDiv = document.createElement('div');
    mDiv.className = "measure";
    mDiv.dataset.num = mi + 1;

    // 删除小节
    const delM = document.createElement("button");
    delM.className = "del-measure";
    delM.textContent = "×";
    delM.onclick = () => { Editor.measures.splice(mi, 1); renderScore(); };
    mDiv.appendChild(delM);

    // 音符块
    m.forEach((n, ni) => {
      const el = document.createElement("div");
      el.className = "note-block" + (n.type === "rest" ? " rest" : "");
      el.textContent = (n.type === "rest" ? "—" : pitchToNum(n.step));
      
      // 添加八度升降标记
      if (n.octaveShift === 1) {
        el.classList.add("octave-up");
      } else if (n.octaveShift === -1) {
        el.classList.add("octave-down");
      }
      
      // 添加升降号标记
      if (n.type !== "rest" && n.alter === 1) {
        el.classList.add("sharp");
      } else if (n.type !== "rest" && n.alter === -1) {
        el.classList.add("flat");
      }
      
      // 添加增时线（右侧横线）
      if (n.extendLine && n.extendLine > 0) {
        const extendDiv = document.createElement("div");
        extendDiv.className = "extend-line";
        for (let i = 0; i < n.extendLine; i++) {
          const line = document.createElement("span");
          line.textContent = "—";
          extendDiv.appendChild(line);
        }
        el.appendChild(extendDiv);
      }
      
      // 添加减时线（下方横线）
      // 根据时值自动添加：八分音符=1条线，十六分音符=2条线
      let autoReduceLine = 0;
      if (n.duration === 1) autoReduceLine = 1; // 八分音符
      if (n.duration === 0.5) autoReduceLine = 2; // 十六分音符
      
      const totalReduceLine = (n.reduceLine || 0) + autoReduceLine;
      if (totalReduceLine > 0) {
        const reduceDiv = document.createElement("div");
        reduceDiv.className = "reduce-line";
        for (let i = 0; i < totalReduceLine; i++) {
          const line = document.createElement("span");
          reduceDiv.appendChild(line);
        }
        el.appendChild(reduceDiv);
      }
      
      // 添加附点
      if (n.dotted && n.dotted > 0) {
        const dottedDiv = document.createElement("div");
        dottedDiv.className = "dotted-mark";
        dottedDiv.textContent = "·";
        el.appendChild(dottedDiv);
      }
      
      if (Editor.selected && Editor.selected.mi === mi && Editor.selected.ni === ni)
        el.classList.add("selected");
      // 删除按钮
      const del = document.createElement("button");
      del.className = "del-note";
      del.textContent = "×";
      del.onclick = e => {
        e.stopPropagation();
        m.splice(ni, 1);
        renderScore();
      };
      el.appendChild(del);
      el.onclick = () => selectNote(mi, ni, el);
      el.dataset.noteIndex = ni;
      mDiv.appendChild(el);
    });

    // 绘制连音线
    m.forEach((n, ni) => {
      if (n.slur === "start" && ni < m.length - 1) {
        // 查找对应的stop
        let stopIndex = -1;
        for (let i = ni + 1; i < m.length; i++) {
          if (m[i].slur === "stop") {
            stopIndex = i;
            break;
          }
        }
        
        if (stopIndex !== -1) {
          // 创建连音线
          const slurDiv = document.createElement('div');
          slurDiv.className = 'slur-line';
          
          // 使用setTimeout确保音符已经渲染
          setTimeout(() => {
            const startNote = mDiv.querySelector(`[data-note-index="${ni}"]`);
            const endNote = mDiv.querySelector(`[data-note-index="${stopIndex}"]`);
            
            if (startNote && endNote) {
              const startRect = startNote.getBoundingClientRect();
              const endRect = endNote.getBoundingClientRect();
              const measureRect = mDiv.getBoundingClientRect();
              
              const startX = startRect.left - measureRect.left + startRect.width / 2;
              const endX = endRect.left - measureRect.left + endRect.width / 2;
              const y = startRect.bottom - measureRect.top + 5;
              
              const width = endX - startX;
              const height = 20;
              
              slurDiv.style.left = startX + 'px';
              slurDiv.style.top = (y - 10) + 'px';
              slurDiv.style.width = width + 'px';
              
              // 创建SVG弧线
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              
              const d = `M 0,0 Q ${width / 2},${height} ${width},0`;
              path.setAttribute('d', d);
              path.setAttribute('stroke', '#333');
              path.setAttribute('stroke-width', '1.5');
              path.setAttribute('fill', 'none');
              
              svg.appendChild(path);
              slurDiv.appendChild(svg);
              mDiv.appendChild(slurDiv);
            }
          }, 0);
        }
      }
    });

    area.appendChild(mDiv)
  });
}

// ---------- 选择 & 更新音符 ----------
function selectNote(mi, ni, el) {
  document.querySelectorAll(".note-block").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  Editor.selected = { mi, ni };
  const n = Editor.measures[mi][ni];
  document.getElementById("noSelection").style.display = "none";
  const form = document.getElementById("editorForm");
  form.style.display = "block";
  form.querySelector("#editStep").value = n.step || "C";
  form.querySelector("#editAlter").value = n.alter || 0;
  form.querySelector("#editOctave").value = n.octave || 4;
  form.querySelector("#editOctaveShift").value = n.octaveShift || 0;
  form.querySelector("#editDur").value = n.duration || 2;
  form.querySelector("#editExtendLine").value = n.extendLine || 0;
  form.querySelector("#editReduceLine").value = n.reduceLine || 0;
  form.querySelector("#editDotted").value = n.dotted || 0;
  form.querySelector("#editSlur").value = n.slur || "";
  form.querySelector("#editBeam").value = n.beam || "";
}

document.addEventListener('DOMContentLoaded', () => {
  // ---------- 更新音符按钮 ----------
  document.getElementById("updateNote").onclick = () => {
    const s = Editor.selected;
    if (!s) return;
    const n = Editor.measures[s.mi][s.ni];
    n.step = document.getElementById("editStep").value;
    n.alter = parseInt(document.getElementById("editAlter").value);
    n.octave = parseInt(document.getElementById("editOctave").value);
    n.octaveShift = parseInt(document.getElementById("editOctaveShift").value);
    n.duration = parseInt(document.getElementById("editDur").value);
    n.extendLine = parseInt(document.getElementById("editExtendLine").value);
    n.reduceLine = parseInt(document.getElementById("editReduceLine").value);
    n.dotted = parseInt(document.getElementById("editDotted").value);
    n.xml_type = durName(n.duration);
    n.slur = document.getElementById("editSlur").value || undefined;
    n.beam = document.getElementById("editBeam").value || undefined;
    renderScore();
  };

  // ---------- 添加音符 ----------
  document.getElementById("addNoteBtn").onclick = () => {
    const active = document.querySelector(".tone.activeStep");
    const step = active ? active.dataset.step : null;
    const alter = parseInt(document.getElementById("alterSel").value);
    const oct = parseInt(document.getElementById("octSel").value);
    const octaveShift = parseInt(document.getElementById("octaveShiftSel").value);
    const dur = parseInt(document.getElementById("durSel").value);
    const extendLine = parseInt(document.getElementById("extendLineSel").value);
    const reduceLine = parseInt(document.getElementById("reduceLineSel").value);
    const dotted = parseInt(document.getElementById("dottedSel").value);
    const note = step
      ? { type: "note", step, alter, octave: oct, octaveShift, duration: dur, extendLine, reduceLine, dotted, xml_type: durName(dur) }
      : { type: "rest", duration: dur, extendLine, reduceLine, xml_type: durName(dur) };
    if (Editor.measures.length === 0) Editor.measures.push([]);
    Editor.measures.at(-1).push(note);
    renderScore();
  };

  // ---------- UI事件 ----------
  document.querySelectorAll(".tone").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tone").forEach(b => b.classList.remove("activeStep"));
      btn.classList.add("activeStep");
    };
  });
  
  document.getElementById("restBtn").onclick = () => {
    document.querySelectorAll(".tone").forEach(b => b.classList.remove("activeStep"));
  };

  document.getElementById("btnNewMeasure").onclick = () => {
    Editor.measures.push([]);
    renderScore();
  };

  // ---------- 导出 MXL ----------
  document.getElementById("btnExportMXL").onclick = async () => {
    let title = document.getElementById("titleInput").value.trim() || "我的第一首歌曲";
    let artist = document.getElementById("composerInput").value.trim() || "某歌手";

    const body = {
      title,
      artist,
      measures: Editor.measures.map((m, i) => ({
        number: i + 1,
        bpm: 120,
        new_system: i % 4 === 0, // 每4小节换行
        notes: m
      }))
    };

    try {
      const res = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error("服务器返回错误");

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title}.mxl`;
      a.click();
    } catch (err) {
      alert("导出失败：" + err.message);
    }
  };

  // 初始渲染
  renderScore();
});
