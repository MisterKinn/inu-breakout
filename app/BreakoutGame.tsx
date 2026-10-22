"use client";

import { CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Screen = "START" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "WON" | "LOST";
type Brick = { x: number; y: number; w: number; h: number; color: string; red: boolean; alive: boolean };
type RecordItem = { name: string; finishTime: string; milliseconds?: number };

const W = 720;
const H = 720;
const TARGET_RED = 3;
const BASE_BALL_SPEED = 8.4;
const COLORS = ["#ff9f43", "#ffd166", "#54a0ff", "#46d39a", "#a78bfa"];
const RED = "#ff5364";
const FIREWORK_COLORS = ["#2563eb", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];
const FIREWORKS = Array.from({ length: 72 }, (_, index) => {
  const angle = (index % 24) * Math.PI / 12;
  const distance = 120 + (index % 6) * 18;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, delay: (index % 6) * .035, burst: Math.floor(index / 24), color: FIREWORK_COLORS[index % FIREWORK_COLORS.length] };
});

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function numericTime(value: string) {
  const [m = "0", s = "0"] = value.split(":");
  return Number(m) * 60 + Number(s);
}

function makeBricks(testMode = false): Brick[] {
  const redIndexes = new Set<number>();
  let colors: string[];
  if (testMode) {
    while (redIndexes.size < 12) redIndexes.add(Math.floor(Math.random() * 40));
    colors = Array.from({ length: 40 }, (_, i) => redIndexes.has(i) ? RED : COLORS[Math.floor(Math.random() * COLORS.length)]);
  } else {
    const palette = [RED, ...COLORS];
    do {
      colors = Array.from({ length: 40 }, () => palette[Math.floor(Math.random() * palette.length)]);
    } while (colors.filter((color) => color === RED).length < TARGET_RED);
    colors.forEach((color, i) => { if (color === RED) redIndexes.add(i); });
  }
  return Array.from({ length: 40 }, (_, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const color = colors[i];
    const red = color === RED;
    return { x: 32 + col * 82, y: 88 + row * 40, w: 72, h: 27, red, alive: true, color };
  });
}

export default function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<Screen>("START");
  const nameRef = useRef("");
  const rafRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const stateRef = useRef({ paddleX: W / 2 - 70, ballX: W / 2, ballY: H - 100, vx: 5.3, vy: -6.6, lives: 3, red: 0, bricks: makeBricks(), keys: { left: false, right: false } });

  const [screen, setScreenState] = useState<Screen>("START");
  const [name, setName] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [lives, setLives] = useState(3);
  const [redCount, setRedCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordState, setRecordState] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [redHitFeedback, setRedHitFeedback] = useState(false);

  const setScreen = useCallback((next: Screen) => {
    screenRef.current = next;
    setScreenState(next);
  }, []);

  const loadRecords = useCallback(async () => {
    const local: RecordItem[] = JSON.parse(localStorage.getItem("inu-breakout-records") || "[]");
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      const remote = response.ok ? await response.json() : [];
      const data = Array.isArray(remote) && remote.length ? remote : local;
      setRecords(data.sort((a: RecordItem, b: RecordItem) => numericTime(a.finishTime) - numericTime(b.finishTime)).slice(0, 3));
    } catch { setRecords(local.slice(0, 3)); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadRecords, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const resetBall = useCallback(() => {
    const game = stateRef.current;
    const speed = BASE_BALL_SPEED;
    game.paddleX = W / 2 - 70;
    game.ballX = W / 2;
    game.ballY = H - 100;
    game.vx = (Math.random() > .5 ? 1 : -1) * speed * .62;
    game.vy = -speed * .78;
  }, []);

  const beginGame = useCallback(() => {
    const game = stateRef.current;
    game.bricks = makeBricks(testMode);
    game.lives = 3;
    game.red = 0;
    pausedTotalRef.current = 0;
    setLives(3); setRedCount(0); setElapsed(0); setRecordState("");
    resetBall();
    setCountdown(3);
    setScreen("COUNTDOWN");
    let value = 3;
    const timer = window.setInterval(() => {
      value -= 1;
      if (value === 0) {
        window.clearInterval(timer);
        startAtRef.current = performance.now();
        setScreen("PLAYING");
        audioRef.current?.play().catch(() => undefined);
      } else setCountdown(value);
    }, 700);
  }, [resetBall, setScreen, testMode]);

  const onStart = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx && !audioContextRef.current) audioContextRef.current = new AudioCtx();
    audioContextRef.current?.resume().catch(() => undefined);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = .52;
      audioRef.current.play().catch(() => undefined);
    }
    nameRef.current = clean;
    beginGame();
  };

  const finish = useCallback(async () => {
    const time = performance.now() - startAtRef.current - pausedTotalRef.current;
    const finishTime = formatTime(time);
    setElapsed(time);
    setScreen("WON");
    audioRef.current?.pause();
    const next = [...JSON.parse(localStorage.getItem("inu-breakout-records") || "[]"), { name: nameRef.current, finishTime, milliseconds: time }]
      .sort((a: RecordItem, b: RecordItem) => (a.milliseconds ?? numericTime(a.finishTime) * 1000) - (b.milliseconds ?? numericTime(b.finishTime) * 1000)).slice(0, 10);
    localStorage.setItem("inu-breakout-records", JSON.stringify(next));
    setRecords(next.slice(0, 3));
    setRecordState("기록 저장 중…");
    try {
      const response = await fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameRef.current, finishTime }) });
      setRecordState(response.ok ? "기록 저장 완료" : "기기에 기록 저장됨");
      if (response.ok) loadRecords();
    } catch { setRecordState("기기에 기록 저장됨"); }
  }, [loadRecords, setScreen]);

  const hitSound = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-8, now);
    compressor.knee.setValueAtTime(4, now);
    compressor.ratio.setValueAtTime(10, now);
    compressor.attack.setValueAtTime(.001, now);
    compressor.release.setValueAtTime(.08, now);
    gain.gain.setValueAtTime(.78, now);
    gain.gain.setValueAtTime(.78, now + .055);
    gain.gain.exponentialRampToValueAtTime(.001, now + .16);
    gain.connect(compressor); compressor.connect(ctx.destination);
    [960, 1280].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 0 ? "square" : "sine";
      osc.frequency.setValueAtTime(frequency, now);
      osc.connect(gain); osc.start(now); osc.stop(now + .17);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const game = stateRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#e8edf4"; ctx.lineWidth = 1; for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (const brick of game.bricks) if (brick.alive) {
        ctx.shadowColor = brick.color; ctx.shadowBlur = 10; ctx.fillStyle = brick.color; ctx.beginPath(); ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.34)"; ctx.fillRect(brick.x + 8, brick.y + 5, brick.w - 16, 3);
      }
      ctx.shadowBlur = 12; ctx.shadowColor = "#2563eb55"; ctx.fillStyle = "#2563eb"; ctx.beginPath(); ctx.roundRect(game.paddleX, H - 55, 140, 16, 8); ctx.fill();
      ctx.shadowColor = "#0f172a44"; ctx.shadowBlur = 10; ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(game.ballX, game.ballY, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (screenRef.current === "PLAYING") {
        if (game.keys.left) game.paddleX -= 8.5;
        if (game.keys.right) game.paddleX += 8.5;
        game.paddleX = Math.max(0, Math.min(W - 140, game.paddleX));
        game.ballX += game.vx; game.ballY += game.vy;
        if (game.ballX < 9 || game.ballX > W - 9) { game.vx *= -1; game.ballX = Math.max(9, Math.min(W - 9, game.ballX)); }
        let hitBrick = false;
        if (game.vy > 0 && game.ballY + 9 >= H - 55 && game.ballY - 9 <= H - 39 && game.ballX >= game.paddleX && game.ballX <= game.paddleX + 140) {
          const offset = (game.ballX - (game.paddleX + 70)) / 70;
          const speed = Math.hypot(game.vx, game.vy);
          game.vx = offset * speed * .82;
          game.vy = -Math.sqrt(Math.max(speed ** 2 - game.vx ** 2, speed ** 2 * .32));
          game.ballY = H - 65;
        }
        for (const brick of game.bricks) if (brick.alive && game.ballX + 9 > brick.x && game.ballX - 9 < brick.x + brick.w && game.ballY + 9 > brick.y && game.ballY - 9 < brick.y + brick.h) {
          brick.alive = false;
          if (game.vy > 0) {
            game.ballY = brick.y - 9;
            game.vy = -Math.abs(game.vy);
          } else {
            game.ballY = brick.y + brick.h + 9;
            game.vy = Math.abs(game.vy);
          }
          hitBrick = true;
          hitSound();
          if (brick.red) {
            game.red += 1;
            setRedCount(game.red);
            if (game.red < TARGET_RED) {
              setRedHitFeedback(true);
              window.setTimeout(() => setRedHitFeedback(false), 700);
            }
            if (game.red >= TARGET_RED) finish();
          }
          break;
        }
        if (!hitBrick && game.ballY < 97) { game.vy = Math.abs(game.vy); game.ballY = 97; }
        if (game.ballY > H + 12) {
          game.lives -= 1; setLives(game.lives);
          if (game.lives <= 0) { setScreen("LOST"); audioRef.current?.pause(); }
          else resetBall();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [finish, hitSound, resetBall, setScreen]);

  const togglePause = useCallback(() => {
    if (screenRef.current === "PLAYING") { pausedAtRef.current = performance.now(); setScreen("PAUSED"); audioRef.current?.pause(); }
    else if (screenRef.current === "PAUSED") {
      setCountdown(3);
      setScreen("COUNTDOWN");
      let value = 3;
      const timer = window.setInterval(() => {
        value -= 1;
        if (value === 0) {
          window.clearInterval(timer);
          pausedTotalRef.current += performance.now() - pausedAtRef.current;
          setScreen("PLAYING");
          audioRef.current?.play().catch(() => undefined);
        } else setCountdown(value);
      }, 700);
    }
  }, [setScreen]);

  useEffect(() => {
    const tick = window.setInterval(() => { if (screenRef.current === "PLAYING") setElapsed(performance.now() - startAtRef.current - pausedTotalRef.current); }, 250);
    const key = (down: boolean) => (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") stateRef.current.keys.left = down;
      if (event.key === "ArrowRight") stateRef.current.keys.right = down;
      if (down && event.key === " ") togglePause();
    };
    const kd = key(true), ku = key(false); window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { clearInterval(tick); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [togglePause]);

  const movePointer = (clientX: number) => {
    const canvas = canvasRef.current; if (!canvas || !["PLAYING", "PAUSED"].includes(screenRef.current)) return;
    const rect = canvas.getBoundingClientRect(); const x = (clientX - rect.left) * W / rect.width;
    stateRef.current.paddleX = Math.max(0, Math.min(W - 140, x - 70));
  };

  const goStart = () => { audioRef.current?.pause(); setScreen("START"); setName(""); loadRecords(); };

  return <div className="page-shell">
    <audio ref={audioRef} src="/Hyper_Speed_Run.mp3" loop preload="auto" />
    <section className={`game-card ${screen === "START" ? "is-start" : ""}`}>
      <header className="hud">
        <div><span className="eyebrow">INU ARCADE</span><strong>벽돌깨기</strong></div>
        <div className="stats"><span>❤ {lives}</span><span className="red-stat">◆ {redCount}/{TARGET_RED}</span><span>◷ {formatTime(elapsed)}</span></div>
      </header>
      <div className="stage" onPointerMove={(e) => movePointer(e.clientX)}>
        <canvas ref={canvasRef} width={W} height={H} aria-label="벽돌깨기 게임 화면" />
        {redHitFeedback && <div className="hit-feedback" aria-live="polite"><svg viewBox="0 0 24 24" role="img" aria-label="좋아요"><path d="M7.2 10.2v10.1H4.9a1.9 1.9 0 0 1-1.9-1.9v-6.3a1.9 1.9 0 0 1 1.9-1.9h2.3Zm2 10.1V10.2l3.7-7.1a1.5 1.5 0 0 1 2.8.8v4.1h3.7a2.4 2.4 0 0 1 2.3 2.9l-1.4 7.3a2.7 2.7 0 0 1-2.7 2.2H9.2Z" /></svg></div>}
        {screen === "START" && <div className="overlay start-panel">
          <Image src="/Mascot.jpg" width={92} height={92} priority alt="인천대학교 마스코트 횃불이" />
          <h1>INU <em>벽돌깨기</em></h1>
          <p>빨간 벽돌 3개를 찾아 깨보세요.</p>
          <form onSubmit={onStart}>
            <label htmlFor="player-name" className="sr-only">플레이어 이름</label>
            <input id="player-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="이름을 입력하세요" autoComplete="off" />
            <button className="primary" type="submit" disabled={!name.trim()}>▶ 게임 시작</button>
          </form>
          <button className={`test-toggle ${testMode ? "active" : ""}`} type="button" aria-pressed={testMode} onClick={() => setTestMode((current) => !current)}><span />테스트 모드 {testMode ? "ON · 빨강 30% 고정" : "OFF"}</button>
          <div className="ranking"><h2>🏆 TOP 3</h2>{Array.from({ length: 3 }, (_, i) => records[i] ? <div key={`${records[i].name}-${i}`}><span><i>{i + 1}</i>{records[i].name}</span><b>{records[i].finishTime}</b></div> : <div className="empty" key={i}><span><i>{i + 1}</i>아직 기록 없음</span><b>--:--</b></div>)}</div>
          <div className="maker"><b>데이터과학과 · 202601659 · 김성연</b></div>
        </div>}
        {screen === "COUNTDOWN" && <div className="overlay countdown"><span>READY</span><strong key={countdown}>{countdown}</strong><p>방향키 또는 스와이프로 이동</p></div>}
        {screen === "PAUSED" && <div className="overlay modal"><span className="badge">BREAK TIME</span><h2>일시정지</h2><p>잠시 숨을 고르고 다시 시작하세요.</p><button className="primary" onClick={togglePause}>▶ 계속하기</button></div>}
        {screen === "LOST" && <div className="overlay modal"><span className="danger">MISSION FAILED</span><h2>GAME OVER</h2><p>공을 모두 놓쳤습니다. 다시 도전해 보세요!</p><button className="primary" onClick={goStart}>↻ 다시 도전</button><button className="ghost" onClick={goStart}>처음 화면</button></div>}
        {screen === "WON" && <div className="overlay modal win"><div className="fireworks" aria-hidden="true">{FIREWORKS.map((particle, i) => <span key={i} className={`burst-${particle.burst}`} style={{ "--x": `${particle.x}px`, "--y": `${particle.y}px`, "--delay": `${particle.delay}s`, "--color": particle.color } as CSSProperties} />)}</div><span className="success">MISSION COMPLETE</span><h2>완벽합니다!</h2><strong className="finish-time">{formatTime(elapsed)}</strong><p>{name}님의 완주 기록</p><small>{recordState}</small><button className="primary" onClick={goStart}>↻ 다시 도전</button></div>}
      </div>
      {(screen === "PLAYING" || screen === "PAUSED") && <footer className="controls"><button onClick={togglePause}>{screen === "PAUSED" ? "▶ 계속" : "Ⅱ 멈춤"}</button><span>← → 키 / 화면 스와이프</span><button onClick={goStart}>■ 종료</button></footer>}
    </section>
  </div>;
}
