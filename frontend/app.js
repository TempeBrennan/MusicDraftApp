// ---------- 数据结构 ----------
const Editor = {
  measures: [[]],
  selected: null,
  currentSongId: null, // 当前编辑的歌曲ID
};

// ---------- 工具函数 ----------
const durName = d => ({ 0.5: "16th", 1: "eighth", 2: "quarter", 4: "half", 8: "whole" }[d] || "quarter");
const pitchToNum = s => ({ C: "1", D: "2", E: "3", F: "4", G: "5", A: "6", B: "7" }[s] || "?");

// 生成UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ---------- 本地存储管理 ----------
const SongStorage = {
  // 获取所有歌曲
  getAllSongs() {
    const songs = localStorage.getItem('musicDraftSongs');
    return songs ? JSON.parse(songs) : [];
  },
  
  // 保存歌曲
  saveSong(song) {
    const songs = this.getAllSongs();
    const index = songs.findIndex(s => s.id === song.id);
    
    if (index !== -1) {
      songs[index] = song;
    } else {
      songs.push(song);
    }
    
    localStorage.setItem('musicDraftSongs', JSON.stringify(songs));
  },
  
  // 删除歌曲
  deleteSong(id) {
    const songs = this.getAllSongs();
    const filtered = songs.filter(s => s.id !== id);
    localStorage.setItem('musicDraftSongs', JSON.stringify(filtered));
  },
  
  // 获取单个歌曲
  getSong(id) {
    const songs = this.getAllSongs();
    return songs.find(s => s.id === id);
  }
};

// 绘制连梁
function drawBeam(measureDiv, startIndex, endIndex) {
  const startNote = measureDiv.querySelector(`[data-note-index="${startIndex}"]`);
  const endNote = measureDiv.querySelector(`[data-note-index="${endIndex}"]`);
  
  if (!startNote || !endNote) return;
  
  const startRect = startNote.getBoundingClientRect();
  const endRect = endNote.getBoundingClientRect();
  const measureRect = measureDiv.getBoundingClientRect();
  
  const startX = startRect.left - measureRect.left;
  const endX = endRect.right - measureRect.left;
  const y = startRect.bottom - measureRect.top + 2;
  
  const beamDiv = document.createElement('div');
  beamDiv.className = 'beam-line';
  beamDiv.style.position = 'absolute';
  beamDiv.style.left = startX + 'px';
  beamDiv.style.top = y + 'px';
  beamDiv.style.width = (endX - startX) + 'px';
  beamDiv.style.height = '2px';
  beamDiv.style.background = '#333';
  beamDiv.style.pointerEvents = 'none';
  beamDiv.style.zIndex = '2';
  
  measureDiv.appendChild(beamDiv);
}

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

    // 绘制连梁（beam）- 连接连续的八分音符或更短音符
    setTimeout(() => {
      let beamStart = -1;
      m.forEach((n, ni) => {
        const needsBeam = n.type !== "rest" && (n.duration === 1 || n.duration === 0.5);
        
        if (needsBeam && beamStart === -1) {
          // 开始一组连梁
          beamStart = ni;
        } else if (!needsBeam && beamStart !== -1) {
          // 结束一组连梁
          if (ni - beamStart > 1) {
            drawBeam(mDiv, beamStart, ni - 1);
          }
          beamStart = -1;
        }
      });
      
      // 处理最后一组
      if (beamStart !== -1 && m.length - beamStart > 1) {
        drawBeam(mDiv, beamStart, m.length - 1);
      }
    }, 0);

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
  
  // 设置radio button的选中状态
  const setRadio = (name, value) => {
    const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  };
  
  setRadio("editStep", n.step || "C");
  setRadio("editAlter", n.alter || 0);
  setRadio("editOctave", n.octave || 4);
  setRadio("editOctaveShift", n.octaveShift || 0);
  setRadio("editDur", n.duration || 2);
  setRadio("editDotted", n.dotted || 0);
  setRadio("editSlur", n.slur || "");
  setRadio("editBeam", n.beam || "");
}

document.addEventListener('DOMContentLoaded', () => {
  // ---------- 更新音符按钮 ----------
  document.getElementById("updateNote").onclick = () => {
    const s = Editor.selected;
    if (!s) return;
    const n = Editor.measures[s.mi][s.ni];
    
    // 读取radio button的值
    const getRadio = (name) => {
      const radio = document.querySelector(`input[name="${name}"]:checked`);
      return radio ? radio.value : null;
    };
    
    n.step = getRadio("editStep");
    n.alter = parseInt(getRadio("editAlter"));
    n.octave = parseInt(getRadio("editOctave"));
    n.octaveShift = parseInt(getRadio("editOctaveShift"));
    n.duration = parseInt(getRadio("editDur"));
    n.dotted = parseInt(getRadio("editDotted"));
    n.xml_type = durName(n.duration);
    n.slur = getRadio("editSlur") || undefined;
    n.beam = getRadio("editBeam") || undefined;
    renderScore();
  };

  // ---------- 添加音符 ----------
  document.getElementById("addNoteBtn").onclick = () => {
    const active = document.querySelector(".tone.activeStep");
    const step = active ? active.dataset.step : null;
    
    // 读取radio button的值
    const getRadio = (name) => {
      const radio = document.querySelector(`input[name="${name}"]:checked`);
      return radio ? radio.value : null;
    };
    
    const alter = parseInt(getRadio("alter"));
    const oct = parseInt(getRadio("octave"));
    const octaveShift = parseInt(getRadio("octaveShift"));
    const dur = parseInt(getRadio("duration"));
    const dotted = parseInt(getRadio("dotted"));
    const note = step
      ? { type: "note", step, alter, octave: oct, octaveShift, duration: dur, dotted, xml_type: durName(dur) }
      : { type: "rest", duration: dur, xml_type: durName(dur) };
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

  // ---------- 保存歌曲 ----------
  document.getElementById("btnSaveSong").onclick = () => {
    const title = document.getElementById("titleInput").value.trim() || "未命名歌曲";
    const artist = document.getElementById("composerInput").value.trim() || "某歌手";
    
    const song = {
      id: Editor.currentSongId || generateUUID(),
      title,
      artist,
      measures: Editor.measures,
      updatedAt: new Date().toISOString()
    };
    
    SongStorage.saveSong(song);
    Editor.currentSongId = song.id;
    alert(`✅ 歌曲"${title}"已保存！`);
  };

  // ---------- 新建歌曲 ----------
  document.getElementById("btnNewSong").onclick = () => {
    if (confirm("确定要新建歌曲吗？未保存的更改将丢失。")) {
      Editor.measures = [[]];
      Editor.currentSongId = null;
      document.getElementById("titleInput").value = "我的第一首歌曲";
      document.getElementById("composerInput").value = "某歌手";
      renderScore();
    }
  };

  // ---------- 加载歌曲列表 ----------
  document.getElementById("btnLoadSong").onclick = () => {
    showSongList();
  };

  document.getElementById("closeSongList").onclick = () => {
    document.getElementById("songListModal").style.display = "none";
  };

  // 点击背景关闭弹窗
  document.getElementById("songListModal").onclick = (e) => {
    if (e.target.id === "songListModal") {
      document.getElementById("songListModal").style.display = "none";
    }
  };

  // ---------- 显示歌曲列表 ----------
  function showSongList() {
    const songs = SongStorage.getAllSongs();
    const listDiv = document.getElementById("songList");
    
    if (songs.length === 0) {
      listDiv.innerHTML = '<p style="text-align:center; color:#999;">暂无保存的歌曲</p>';
    } else {
      listDiv.innerHTML = songs.map(song => {
        const date = new Date(song.updatedAt).toLocaleString('zh-CN');
        return `
          <div class="song-item">
            <div class="song-info" onclick="loadSong('${song.id}')">
              <div class="song-title">${song.title}</div>
              <div class="song-meta">原唱: ${song.artist} | 更新: ${date} | 小节数: ${song.measures.length}</div>
            </div>
            <div class="song-actions">
              <button onclick="loadSong('${song.id}')">打开</button>
              <button class="delete-btn" onclick="deleteSong('${song.id}', event)">删除</button>
            </div>
          </div>
        `;
      }).join('');
    }
    
    document.getElementById("songListModal").style.display = "flex";
  }

  // 加载歌曲
  window.loadSong = (id) => {
    const song = SongStorage.getSong(id);
    if (song) {
      Editor.measures = song.measures;
      Editor.currentSongId = song.id;
      document.getElementById("titleInput").value = song.title;
      document.getElementById("composerInput").value = song.artist;
      renderScore();
      document.getElementById("songListModal").style.display = "none";
    }
  };

  // 删除歌曲
  window.deleteSong = (id, event) => {
    event.stopPropagation();
    const song = SongStorage.getSong(id);
    if (song && confirm(`确定要删除歌曲"${song.title}"吗？`)) {
      SongStorage.deleteSong(id);
      showSongList();
    }
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
