/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import p5 from 'p5';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: any) => {
      let rows = [
        ["1","2","3","4","5","6","7","8","9","0","DEL"],
        ["Q","W","E","R","T","Y","U","I","O","P","ENT"],
        ["A","S","D","F","G","H","J","K","L"],
        ["Z","X","C","V","B","N","M",",",".","!","?"]
      ];

      let typedText = "";
      let activeKey: string | null = null;
      let activeTime = 0;

      let keyPositions: Record<string, { x: number; y: number }> = {};
      let textPoints: Array<{ char: string; x: number; y: number }> = [];

      let cursorBlink = 0;
      let expandEnergy = 1;
      let lastKeyTime = 0;
      let typingSpeed = 1;

      let wasPressed = false;
      let inputLock = false;

      let layout: any = {};
      
      let activeAchievement: any = null;
      let lastTriggeredNormalized = "";

      const achievements = [
        { text: "ILOVEYOU", title: "情话一级选手" },
        { text: "110", title: "守法热心市民" },
        { text: "119", title: "火势还没来，你先呼叫上了？" },
        { text: "120", title: "保命意识天花板" },
        { text: "HELPME", title: "在线求助小哭包" },
        { text: "CXY", title: "可以啊，这都被你找到了！" },
        { text: "CAIXINYI", title: "实名打卡达人" },
        { text: "GOODGOODSTUDYDAYDAYUP", title: "中式英语传承人" },
        { text: "HELLO", title: "礼貌开场白选手" },
        { text: "THANKYOU", title: "懂感恩模范选手" },
        { text: "666", title: "民间捧场之王" },
        { text: "233", title: "笑点超低，一笑就停不下来" },
        { text: "OMG", title: "欧米茄，集美!" },
        { text: "YES", title: "果断同意达人" },
        { text: "NO", title: "高冷拒绝专业户" },
        { text: "BYEBYE", title: "溜了溜了，优雅退场第一人" },
        { text: "HHHH", title: "笑点沦陷显眼包" },
        { text: "SORRY", title: "道歉超快老实人" },
        { text: "GOGOGO", title: "gogogo,出发喽！" },
        { text: "BIUBIU", title: "可爱发射小机枪" }
      ];

      function checkAchievements() {
          let normalizedTarget = typedText.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (normalizedTarget === lastTriggeredNormalized) return;
          
          for (let ach of achievements) {
              if (normalizedTarget.endsWith(ach.text)) {
                  activeAchievement = {
                      title: ach.title,
                      triggerTime: p.millis()
                  };
                  playSound('achievement');
                  lastTriggeredNormalized = normalizedTarget;
                  break;
              }
          }
      }

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.textFont("Press Start 2P");
        p.noSmooth();
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      p.draw = () => {
        updateLayout();

        p.background('#ede8d0');
        
        if (layout.pixelGridSize) {
          p.stroke('#dfd8be');
          p.strokeWeight(1);
          let gSize = layout.pixelGridSize;
          for(let x = 0; x < p.width; x += gSize) p.line(x, 0, x, p.height);
          for(let y = 0; y < p.height; y += gSize) p.line(0, y, p.width, y);
        }

        cursorBlink = p.millis() * 0.005;

        let isPressed = p.mouseIsPressed;

        if (isPressed && !wasPressed && !inputLock) {
          handleTouch(p.mouseX, p.mouseY);
          inputLock = true;
        }

        if (!isPressed) inputLock = false;

        wasPressed = isPressed;

        updateTypingEnergy();
        buildTextPoints();

        drawTypedText();
        drawKeyboard();
        drawConnections();
        drawCursor();
        drawSpaceBar();
        drawRefreshKey();
        drawRecordKey();
        drawAchievement();

        if (p.millis() - activeTime > 150) {
          activeKey = null;
        }
      };

      function updateLayout() {
        let normRowSpacing = 10;
        let normKeySpacing = 10;
        let normCircleSize = 8.5;
        
        let textY = 0;
        let kbTopY = 32;
        let kbBtmY = kbTopY + 3 * normRowSpacing;
        let spaceY = kbBtmY + 1.5 * normRowSpacing;
        let refreshY = spaceY + 1.2 * normRowSpacing;
        let spaceH = 6.0;
        
        // Compute bounding box purely for scaling
        let topBound = textY - 12; // Extra room for typed text height
        let btmBound = refreshY + spaceH / 2 + 6; // Extra room below refresh button
        let normH = btmBound - topBound;
        let normW = 10 * normKeySpacing + normCircleSize + 20; // 10 units padding each side
        
        let scale = p.min(p.width / normW, p.height / normH);
        
        // Find visual center in normal coordinates to center everything at screen height / 2
        let centerY = (topBound + btmBound) / 2;
        
        layout.textY = p.height / 2 + (textY - centerY) * scale;
        layout.keyboardTop = p.height / 2 + (kbTopY - centerY) * scale;
        
        layout.rowSpacing = normRowSpacing * scale;
        layout.keySpacing = normKeySpacing * scale;
        layout.circleSize = normCircleSize * scale;
        
        layout.keyboardBottom = layout.keyboardTop + layout.rowSpacing * (rows.length - 1);
        
        layout.spaceWidth = 65 * scale;
        layout.spaceHeight = spaceH * scale;
        layout.spaceY = p.height / 2 + (spaceY - centerY) * scale;
        layout.refreshY = p.height / 2 + (refreshY - centerY) * scale;
        
        let gap = 2 * scale;
        layout.actionBtnWidth = (layout.spaceWidth - gap) / 2;
        layout.refreshX = p.width / 2 - gap / 2 - layout.actionBtnWidth / 2;
        layout.recordX = p.width / 2 + gap / 2 + layout.actionBtnWidth / 2;
        
        layout.typeSize = 5.5 * scale;
        layout.keyTextSize = 4.0 * scale;
        layout.cursorHeight = 3.5 * scale;
        layout.connectionFlow = 2.5 * scale;
        
        layout.pixelGridSize = 2.0 * scale;
        layout.pixelSize = Math.max(2, 0.4 * scale);
      }

      function handleTouch(mx: number, my: number) {
        if (activeAchievement && p.millis() - activeAchievement.triggerTime < 10000) {
            let cx = activeAchievement.x;
            let cy = activeAchievement.y;
            let cw = activeAchievement.w;
            let ch = activeAchievement.h;
            if (
                mx > cx - cw / 2 - 4 &&
                mx < cx + cw / 2 + 4 &&
                my > cy - ch / 2 - 4 &&
                my < cy + ch / 2 + 4
            ) {
                activeAchievement = null;
                return;
            }
        }

        // SPACE
        let sx = p.width / 2;
        let sy = layout.spaceY;
        let sw = layout.spaceWidth;
        let sh = layout.spaceHeight;

        if (
          mx > sx - sw / 2 &&
          mx < sx + sw / 2 &&
          my > sy - sh / 2 &&
          my < sy + sh / 2
        ) {
          triggerKey(" ");
          return;
        }

        // REFRESH
        let ry = layout.refreshY;
        let rh = layout.spaceHeight;

        if (
          mx > layout.refreshX - layout.actionBtnWidth / 2 &&
          mx < layout.refreshX + layout.actionBtnWidth / 2 &&
          my > ry - rh / 2 &&
          my < ry + rh / 2
        ) {
          triggerKey("REFRESH");
          return;
        }

        // RECORD
        if (
          mx > layout.recordX - layout.actionBtnWidth / 2 &&
          mx < layout.recordX + layout.actionBtnWidth / 2 &&
          my > ry - rh / 2 &&
          my < ry + rh / 2
        ) {
          triggerKey("RECORD");
          return;
        }

        // KEYS
        for (let k in keyPositions) {
          if (k === " ") continue;

          let pt = keyPositions[k];
          if (
            mx > pt.x - layout.circleSize / 2 &&
            mx < pt.x + layout.circleSize / 2 &&
            my > pt.y - layout.circleSize / 2 &&
            my < pt.y + layout.circleSize / 2
          ) {
            triggerKey(k);
            return;
          }
        }
      }

      let audioCtx: AudioContext | null = null;
      function initAudio() {
        if (!audioCtx) {
          const AC = window.AudioContext || (window as any).webkitAudioContext;
          if (AC) {
              audioCtx = new AC();
          }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      }

      function playSound(type: 'tap' | 'del' | 'enter' | 'refresh' | 'achievement') {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'tap') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(400 + Math.random() * 200, t);
          gain.gain.setValueAtTime(0.05, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
        } else if (type === 'del') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(300, t);
          osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
          gain.gain.setValueAtTime(0.05, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.start(t);
          osc.stop(t + 0.15);
        } else if (type === 'enter') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(300, t);
          osc.frequency.setValueAtTime(450, t + 0.05);
          gain.gain.setValueAtTime(0.05, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.start(t);
          osc.stop(t + 0.15);
        } else if (type === 'refresh') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(200, t);
          osc.frequency.linearRampToValueAtTime(600, t + 0.2);
          gain.gain.setValueAtTime(0.05, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.start(t);
          osc.stop(t + 0.2);
        } else if (type === 'achievement') {
          const osc2 = audioCtx.createOscillator();
          osc2.connect(gain);
          osc.type = 'square';
          osc2.type = 'square';
          osc.frequency.setValueAtTime(261.63, t); // C4
          osc.frequency.setValueAtTime(329.63, t + 0.1); // E4
          osc.frequency.setValueAtTime(392.00, t + 0.2); // G4
          osc.frequency.setValueAtTime(523.25, t + 0.3); // C5
          osc2.frequency.setValueAtTime(261.63 * 1.5, t);
          osc2.frequency.setValueAtTime(329.63 * 1.5, t + 0.1);
          osc2.frequency.setValueAtTime(392.00 * 1.5, t + 0.2);
          osc2.frequency.setValueAtTime(523.25 * 1.5, t + 0.3);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
          gain.gain.setValueAtTime(0.1, t + 0.4);
          gain.gain.linearRampToValueAtTime(0, t + 0.6);
          osc.start(t);
          osc.stop(t + 0.6);
          osc2.start(t);
          osc2.stop(t + 0.6);
        }
      }

      let isRecording = false;
      let mediaRecorder: any = null;
      let recordedChunks: Blob[] = [];

      function toggleRecording() {
        if (!isRecording) {
          try {
            const canvas = containerRef.current?.querySelector('canvas');
            if (!canvas) return;
            const stream = (canvas as any).captureStream(30);
            
            let options = { mimeType: 'video/mp4' };
            if (!MediaRecorder.isTypeSupported('video/mp4')) {
               options = { mimeType: 'video/webm' };
            }
            mediaRecorder = new MediaRecorder(stream, options);
            recordedChunks = [];
            mediaRecorder.ondataavailable = (e: any) => {
              if (e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorder.onstop = () => {
              const blob = new Blob(recordedChunks, { type: options.mimeType });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const ext = options.mimeType.includes('mp4') ? 'mp4' : 'webm';
              a.download = `recording.${ext}`;
              a.click();
              URL.revokeObjectURL(url);
            };
            mediaRecorder.start();
            isRecording = true;
          } catch(e) {
            console.error("Recording failed", e);
          }
        } else {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          isRecording = false;
        }
      }

      function triggerKey(k: string) {
        initAudio();
        if (!k) return;

        activeKey = k;
        activeTime = p.millis();
        lastKeyTime = p.millis();

        if (k === "DEL") {
          playSound('del');
          typedText = typedText.slice(0, -1);
          return;
        }

        if (k === "REFRESH") {
          playSound('refresh');
          typedText = "";
          return;
        }

        if (k === "RECORD") {
          playSound('tap');
          toggleRecording();
          return;
        }

        if (k === "ENT" || k === "ENTER") {
          playSound('enter');
          typedText += '\n';
          return;
        }

        playSound('tap');
        typedText += k;
        checkAchievements();
      }

      p.keyPressed = () => {
        if (p.keyCode === p.BACKSPACE) {
          triggerKey("DEL");
          return false;
        }

        if (p.key === " ") {
          triggerKey(" ");
          return false;
        }

        if (p.keyCode === p.ENTER || p.keyCode === p.RETURN) {
          triggerKey("ENT");
          return false;
        }

        let k = p.key;
        if (!k || k.length !== 1) return false;

        k = k.toUpperCase();

        let code = k.charCodeAt(0);
        let isNumber = code >= 48 && code <= 57;
        let isLetter = code >= 65 && code <= 90;
        let isPunctuation = k === ',' || k === '.' || k === '!' || k === '?';

        if (!isNumber && !isLetter && !isPunctuation) return false;

        triggerKey(k);

        return false;
      };

      function updateTypingEnergy() {
        let now = p.millis();
        let dt = now - lastKeyTime;

        let speed = p.constrain(200 / p.max(dt, 1), 0.5, 3);

        typingSpeed = p.lerp(typingSpeed, speed, 0.05);

        let targetExpand = p.map(speed, 0.5, 3, 1.2, 2.8);

        expandEnergy = p.lerp(expandEnergy, targetExpand, 0.08);

        expandEnergy = p.max(1.2, expandEnergy * 0.995);
      }

      function buildTextPoints() {
        textPoints = [];

        p.textSize(layout.typeSize);

        let tracking = expandEnergy * 1.5;
        let lines = typedText.split('\n');
        
        let totalTextHeight = lines.length * (layout.typeSize * 1.5);
        let currentY = layout.textY - Math.max(0, totalTextHeight / 2 - (layout.typeSize * 1.5) / 2);

        for (let l = 0; l < lines.length; l++) {
          let lineStr = lines[l];
          let w = 0;
          for (let i = 0; i < lineStr.length; i++) {
            let c = lineStr[i];
            let cw = p.textWidth(c);
            if (c === " ") cw = p.textWidth("A") * 0.6;
            w += cw * tracking;
          }

          let x = p.width / 2 - w / 2;

          for (let i = 0; i < lineStr.length; i++) {
            let c = lineStr[i];
            let cw = p.textWidth(c);
            if (c === " ") cw = p.textWidth("A") * 0.6;
            let centerX = x + (cw * tracking) / 2;

            textPoints.push({
              char: c,
              x: centerX,
              y: currentY
            });

            x += cw * tracking;
          }
          if (l < lines.length - 1) {
            textPoints.push({ char: '\n', x: 0, y: 0 }); // push placeholder for newline to match typedText indices
          }
          currentY += layout.typeSize * 1.5;
        }
      }

      function drawTypedText() {
        p.fill(0);
        p.noStroke();
        p.textSize(layout.typeSize);
        p.textAlign(p.CENTER, p.CENTER);

        for (let pt of textPoints) {
          if (pt.char !== '\n') {
            p.text(pt.char, pt.x, pt.y);
          }
        }
      }

      function drawCursor() {
        p.textSize(layout.typeSize);
        let tracking = expandEnergy * 1.5;
        
        let lines = typedText.split('\n');
        let totalTextHeight = lines.length * (layout.typeSize * 1.5);
        let currentY = layout.textY - Math.max(0, totalTextHeight / 2 - (layout.typeSize * 1.5) / 2);
        
        let lastLine = lines[lines.length - 1];
        let w = 0;
        for (let i = 0; i < lastLine.length; i++) {
          let c = lastLine[i];
          let cw = p.textWidth(c);
          if (c === " ") cw = p.textWidth("A") * 0.6;
          w += cw * tracking;
        }
        
        let x = p.width / 2 + w / 2;
        let y = currentY + (lines.length - 1) * (layout.typeSize * 1.5);
        
        if (p.sin(cursorBlink) < 0) return;

        p.stroke(0);
        p.strokeWeight(2);

        p.line(x, y - layout.typeSize * 0.4, x, y + layout.typeSize * 0.4);
      }

      function drawKeyboard() {
        let spacing = layout.keySpacing;
        keyPositions = {};

        p.textAlign(p.CENTER, p.CENTER);
        
        let timeSinceLastKey = p.millis() - lastKeyTime;
        let idleFactor = p.constrain((timeSinceLastKey - 1000) / 1000.0, 0, 1);

        for (let r = 0; r < rows.length; r++) {
          let letters = rows[r];
          let rowWidth = (letters.length - 1) * spacing;
          let startX = p.width / 2 - rowWidth / 2;
          let baseY = layout.keyboardTop + r * layout.rowSpacing;

          for (let i = 0; i < letters.length; i++) {
            let k = letters[i];
            let x = startX + i * spacing;

            let idleY = 0;
            if (idleFactor > 0) {
              idleY = p.sin(p.millis() * 0.002 + r * 1.5 + i * 0.5) * (layout.circleSize * 0.15) * idleFactor;
            }
            let y = baseY + idleY;

            keyPositions[k] = { x, y };

            let isActive = (k === activeKey && p.millis() - activeTime < 150);

            if (isActive) {
              p.fill(0);
              p.stroke(0);
              p.strokeWeight(2);
            } else {
              p.fill(255);
              p.stroke(0);
              p.strokeWeight(2);
            }

            p.rectMode(p.CENTER);
            p.rect(x, y, layout.circleSize, layout.circleSize);

            if (isActive) {
              p.fill(255);
            } else {
              p.fill(0);
            }

            p.noStroke();
            let isSpecial = k === "DEL" || k === "ENT";
            p.textSize(isSpecial ? layout.keyTextSize * 0.45 : layout.keyTextSize);
            p.text(k, x, y);
          }
        }
      }

      function drawSpaceBar() {
        let timeSinceLastKey = p.millis() - lastKeyTime;
        let idleFactor = p.constrain((timeSinceLastKey - 1000) / 1000.0, 0, 1);
        let idleY = 0;
        if (idleFactor > 0) {
          idleY = p.sin(p.millis() * 0.002 + 5) * (layout.spaceHeight * 0.15) * idleFactor;
        }

        let x = p.width / 2;
        let y = layout.spaceY + idleY;

        let isActive = (activeKey === " " && p.millis() - activeTime < 150);

        if (isActive) {
          p.fill(0);
          p.stroke(0);
          p.strokeWeight(2);
        } else {
          p.fill(255);
          p.stroke(0);
          p.strokeWeight(2);
        }

        p.rectMode(p.CENTER);
        p.rect(x, y, layout.spaceWidth, layout.spaceHeight);

        let ts = layout.spaceHeight * 0.4;

        if (isActive) p.fill(255);
        else p.fill(0);

        p.noStroke();
        p.textSize(ts);
        p.text("SPACE", x, y);
      }

      function drawRefreshKey() {
        let timeSinceLastKey = p.millis() - lastKeyTime;
        let idleFactor = p.constrain((timeSinceLastKey - 1000) / 1000.0, 0, 1);
        let idleY = 0;
        if (idleFactor > 0) {
          idleY = p.sin(p.millis() * 0.002 + 6) * (layout.spaceHeight * 0.15) * idleFactor;
        }

        let x = layout.refreshX;
        let y = layout.refreshY + idleY;
        let w = layout.actionBtnWidth;
        let h = layout.spaceHeight;

        let isActive = (activeKey === "REFRESH" && p.millis() - activeTime < 150);

        if (typeof y !== "number" || isNaN(y)) return;

        if (isActive) {
          p.fill(0);
          p.stroke(0);
          p.strokeWeight(2);
        } else {
          p.fill(255, 50);
          p.stroke(0);
          p.strokeWeight(2);
        }

        p.rectMode(p.CENTER);
        p.rect(x, y, w, h);

        let ts = h * 0.4;
        p.textSize(ts);
        const textStr = "CLICK HERE TO REFRESH";
        const tw = p.textWidth(textStr);
        if (tw > w * 0.9) {
          ts = ts * (w * 0.9 / tw);
          p.textSize(ts);
        }

        if (isActive) p.fill(255);
        else p.fill(0);

        p.noStroke();
        p.text(textStr, x, y);
      }

      function drawRecordKey() {
        let timeSinceLastKey = p.millis() - lastKeyTime;
        let idleFactor = p.constrain((timeSinceLastKey - 1000) / 1000.0, 0, 1);
        let idleY = 0;
        if (idleFactor > 0) {
          idleY = p.sin(p.millis() * 0.002 + 7) * (layout.spaceHeight * 0.15) * idleFactor;
        }

        let x = layout.recordX;
        let y = layout.refreshY + idleY;
        let w = layout.actionBtnWidth;
        let h = layout.spaceHeight;

        let isActive = (activeKey === "RECORD" && p.millis() - activeTime < 150);
        let isRec = isRecording && (p.millis() % 1000 < 500);

        if (typeof y !== "number" || isNaN(y)) return;

        if (isActive) {
          p.fill(0);
          p.stroke(0);
          p.strokeWeight(2);
        } else {
          if (isRecording) {
             p.fill(isRec ? 255 : p.color(255, 100, 100));
          } else {
             p.fill(255, 50);
          }
          p.stroke(0);
          p.strokeWeight(2);
        }

        p.rectMode(p.CENTER);
        p.rect(x, y, w, h);

        let ts = h * 0.4;
        p.textSize(ts);
        const textStr = isRecording ? "STOP RECORDING" : "START RECORDING";
        const tw = p.textWidth(textStr);
        if (tw > w * 0.9) {
          ts = ts * (w * 0.9 / tw);
          p.textSize(ts);
        }

        if (isActive) p.fill(255);
        else p.fill(0);

        p.noStroke();
        p.text(textStr, x, y);
      }

      function drawAchievement() {
        if (!activeAchievement) return;
        let elapsed = p.millis() - activeAchievement.triggerTime;
        if (elapsed > 10000) {
            activeAchievement = null;
            return;
        }

        let cardW = p.width * 0.8;
        if (cardW > 800) cardW = 800; // max width
        let cardH = 80;
        let cardX = p.width / 2;
        let cardY = p.height * 0.15; // top area
        
        let alpha = 255;
        if (elapsed < 500) {
            alpha = p.map(elapsed, 0, 500, 0, 255);
        } else if (elapsed > 9500) {
            alpha = p.map(elapsed, 9500, 10000, 255, 0);
        }
        
        activeAchievement.x = cardX;
        activeAchievement.y = cardY;
        activeAchievement.w = cardW;
        activeAchievement.h = cardH;

        p.push();
        p.rectMode(p.CENTER);
        
        // Pixel border effect
        p.noStroke();
        p.fill(0, alpha);
        // Shadow/outer border
        p.rect(cardX + 4, cardY + 4, cardW, cardH);
        
        p.fill(0, alpha);
        p.rect(cardX, cardY, cardW + 8, cardH);
        p.rect(cardX, cardY, cardW, cardH + 8);
        
        p.fill(255, alpha);
        p.rect(cardX, cardY, cardW, cardH);
        
        p.fill(0, alpha);
        p.textAlign(p.CENTER, p.CENTER);
        
        // Header
        p.textSize(12);
        p.text("恭喜触发成就", cardX, cardY - 20);
        
        // Title
        p.textSize(20);
        p.text(activeAchievement.title, cardX, cardY + 10);
        
        p.pop();
      }

      function drawConnections() {
        p.noStroke();
        p.fill(255, 0, 0);

        for (let i = 0; i < textPoints.length; i++) {
          let pt = textPoints[i];
          let k = typedText[i];

          if (!keyPositions[k]) continue;

          let keyPos = keyPositions[k];

          let tx = pt.x;
          let ty = pt.y + layout.typeSize * 0.3;

          let midX = (keyPos.x + tx) / 2;
          let midY = (keyPos.y + ty) / 2;

          let flow = p.sin(p.frameCount * 0.05 + i) * layout.connectionFlow;

          let cx1 = midX + flow;
          let cy1 = midY - flow;
          
          let cx2 = cx1;
          let cy2 = cy1;

          let pSize = layout.pixelSize || 4;
          let dist = p.dist(keyPos.x, keyPos.y, tx, ty);
          let steps = Math.floor(dist / (pSize * 0.5));
          steps = Math.max(steps, 20);

          p.rectMode(p.CENTER);
          for (let j = 0; j <= steps; j++) {
            let t = j / steps;
            let bx = p.bezierPoint(keyPos.x, cx1, cx2, tx, t);
            let by = p.bezierPoint(keyPos.y, cy1, cy2, ty, t);
            
            // Snap to blocky grid
            let px = Math.floor(bx / pSize) * pSize;
            let py = Math.floor(by / pSize) * pSize;
            
            p.rect(px, py, pSize, pSize);
          }
        }
      }
    };

    const myP5 = new p5(sketch, containerRef.current);

    return () => {
      myP5.remove();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-[100dvh] overflow-hidden select-none touch-none" />;
}

