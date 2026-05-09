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

      function playSound(type: 'tap' | 'del' | 'enter' | 'refresh') {
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

        for (let r = 0; r < rows.length; r++) {
          let letters = rows[r];
          let rowWidth = (letters.length - 1) * spacing;
          let startX = p.width / 2 - rowWidth / 2;
          let y = layout.keyboardTop + r * layout.rowSpacing;

          for (let i = 0; i < letters.length; i++) {
            let k = letters[i];
            let x = startX + i * spacing;

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
        let x = p.width / 2;
        let y = layout.spaceY;

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
        let x = layout.refreshX;
        let y = layout.refreshY;
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
        let x = layout.recordX;
        let y = layout.refreshY;
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

